document.addEventListener('DOMContentLoaded', initializeApp);

const LIFF_ID = "2009023539-6ANIeNDa"; 
// ★デプロイ後に発行された新しいURLに書き換えてください
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 

let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 15 };
let currentModalItem = null;

const dom = {}; 

const FALLBACK_MENU_DATA = [{
    id: 'error', category: 'エラー', name: 'メニュー読込失敗',
    description: '通信エラーが発生しました。',
    imageUrl: 'https://placehold.co/300x200/ccc/333?text=Error',
    options: [{ sku: 'err', name: 'ー', price: 0 }], toppings: []
}];

async function initializeApp() {
  if (!LIFF_ID) return showError("LIFF ID未設定");
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    userProfile = await liff.getProfile();
    setupDOM();
    await fetchInitialData();
  } catch (err) { showError(`初期化エラー: ${err.message}`); } 
  finally { if(dom.loading) dom.loading.style.display = 'none'; }
}

function setupDOM() {
    dom.loading = document.getElementById('loading');
    dom.menuContainer = document.getElementById('menu-container');
    
    dom.viewCartButton = document.getElementById('view-cart-button');
    dom.cartItemCount = document.getElementById('cart-item-count');
    dom.cartTotalPrice = document.getElementById('cart-total-price');
    dom.cartModal = document.getElementById('cart-modal');
    dom.closeCartModal = document.getElementById('close-cart-modal');
    dom.submitOrderButton = document.getElementById('submit-order-button');
    dom.cartItemsContainer = document.getElementById('cart-items-container');
    dom.cartModalTotalPrice = document.getElementById('cart-modal-total-price');
    
    dom.itemDetailModal = document.getElementById('item-detail-modal');
    dom.closeItemDetailModal = document.getElementById('close-item-detail-modal');
    dom.itemDetailName = document.getElementById('item-detail-name');
    dom.itemDetailImg = document.getElementById('item-detail-img');
    dom.itemDetailDescription = document.getElementById('item-detail-description');
    
    dom.itemDetailOptions = document.getElementById('item-detail-options');
    dom.sectionFlavors = document.getElementById('section-flavors');
    dom.itemDetailFlavors = document.getElementById('item-detail-flavors');
    dom.flavorNote = document.getElementById('flavor-note');
    dom.itemDetailToppings = document.getElementById('item-detail-toppings');
    
    dom.itemDetailQuantity = document.getElementById('item-detail-quantity');
    dom.itemDetailDecrease = document.getElementById('item-detail-decrease');
    dom.itemDetailIncrease = document.getElementById('item-detail-increase');
    dom.itemDetailTotalPreview = document.getElementById('item-detail-total-preview');
    dom.addToCartButton = document.getElementById('add-to-cart-button');
    
    dom.customAlertModal = document.getElementById('custom-alert-modal');
    dom.customAlertTitle = document.getElementById('custom-alert-title');
    dom.customAlertMessage = document.getElementById('custom-alert-message');
    dom.customAlertOkButton = document.getElementById('custom-alert-ok-button');
    dom.pickupTime = document.getElementById('pickup-time');
    dom.orderNotes = document.getElementById('order-notes');
    dom.recipientName = document.getElementById('recipient-name');

    // 静的イベントリスナー
    dom.viewCartButton.onclick = openCartModal;
    dom.closeCartModal.onclick = closeCartModal;
    dom.cartModal.onclick = (e) => { if (e.target === dom.cartModal) closeCartModal(); };
    dom.closeItemDetailModal.onclick = closeItemDetailModal;
    dom.itemDetailModal.onclick = (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); };
    dom.submitOrderButton.onclick = confirmAndSubmitOrder;

    // 数量ボタン
    dom.itemDetailDecrease.onclick = () => {
        let q = parseInt(dom.itemDetailQuantity.textContent, 10);
        if (q > 1) { dom.itemDetailQuantity.textContent = q - 1; calculateDetailTotal(); }
    };
    dom.itemDetailIncrease.onclick = () => {
        let q = parseInt(dom.itemDetailQuantity.textContent, 10);
        dom.itemDetailQuantity.textContent = q + 1;
        calculateDetailTotal();
    };

    // カート追加ボタン
    dom.addToCartButton.onclick = handleAddToCartClick;
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.message);

        if (data.menu && Array.isArray(data.menu)) {
            menuData = data.menu;
            if (data.settings) storeSettings = { ...storeSettings, ...data.settings };
            displayMenu();
        } else { throw new Error('データ形式エラー'); }
    } catch (err) {
        console.error(err);
        showCustomAlert("通信エラー", `メニューを読み込めませんでした。\n(${err.message})`);
        menuData = FALLBACK_MENU_DATA;
        displayMenu();
    }
}

function displayMenu() {
  dom.menuContainer.innerHTML = '';
  if (!menuData || menuData.length === 0) return;

  const validItems = menuData.filter(item => item && item.category);
  const categories = [...new Set(validItems.map(item => item.category))];
  
  updateCategoryNav(categories);

  categories.forEach(category => {
      const header = document.createElement('h3');
      header.className = 'category-title';
      header.id = `cat-${category}`;
      header.textContent = category;
      dom.menuContainer.appendChild(header);

      const items = validItems.filter(m => m.category === category);
      items.forEach(group => {
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        
        let priceText = '価格要確認';
        if (group.options && group.options.length > 0) {
            const validPrices = group.options.map(o => o.price).filter(p => p > 0);
            if (validPrices.length > 0) priceText = `¥${Math.min(...validPrices)}〜`;
        }

        const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
        const imgDisplayUrl = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;

        card.innerHTML = `
            <img src="${imgDisplayUrl}" alt="${group.name}" onerror="this.src='https://placehold.co/300x200/eee/ccc?text=No+Image'">
            <div class="item-info">
                <p class="item-name">${group.name}</p>
                <p class="item-price">${priceText}</p>
            </div>
        `;
        // カードクリック時の処理
        card.addEventListener('click', () => showItemDetailModal(group));
        dom.menuContainer.appendChild(card);
      });
  });
}

// ... (カテゴリナビゲーション等は既存のままでOK)

function showItemDetailModal(group) {
    currentModalItem = group;

    dom.itemDetailName.textContent = group.name;
    const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
    dom.itemDetailImg.src = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;
    dom.itemDetailDescription.textContent = group.description || '';
    dom.itemDetailQuantity.textContent = '1';

    // オプション（ラジオボタン）
    dom.itemDetailOptions.innerHTML = '';
    if (group.options && group.options.length > 0) {
        group.options.forEach((opt, index) => {
            const label = document.createElement('label');
            label.className = 'option-label';
            const checked = index === 0 ? 'checked' : '';
            label.innerHTML = `
                <span>${opt.name}</span>
                <span class="option-price">¥${opt.price}</span>
                <input type="radio" name="price-option" value="${opt.sku}" data-name="${opt.name}" data-price="${opt.price}" ${checked}>
            `;
            // 変更イベント
            label.querySelector('input').addEventListener('change', () => {
                handleOptionChange(group, opt.sku);
                calculateDetailTotal();
                updateSelectionStyles(dom.itemDetailOptions);
            });
            dom.itemDetailOptions.appendChild(label);
        });
    } else {
        dom.itemDetailOptions.innerHTML = '<p style="color:red">オプションがありません</p>';
    }

    // フレーバー
    dom.itemDetailFlavors.innerHTML = '';
    if (group.flavors && group.flavors.length > 0 && group.flavors[0] !== "") {
        dom.sectionFlavors.style.display = 'block';
        group.flavors.forEach(flavor => {
            if(!flavor) return;
            const label = document.createElement('label');
            label.className = 'option-label';
            label.innerHTML = `<span>${flavor}</span><input type="radio" name="flavor-option" value="${flavor}">`;
            label.querySelector('input').addEventListener('change', () => {
                calculateDetailTotal();
                updateSelectionStyles(dom.itemDetailFlavors);
            });
            dom.itemDetailFlavors.appendChild(label);
        });
        if(group.options && group.options.length > 0) handleOptionChange(group, group.options[0].sku);
    } else {
        dom.sectionFlavors.style.display = 'none';
    }

    // トッピング
    dom.itemDetailToppings.innerHTML = '';
    const toppings = group.toppings || [];
    const tSection = document.getElementById('item-detail-toppings').closest('.option-section');
    if (toppings.length === 0) {
        if(tSection) tSection.style.display = 'none';
    } else {
        if(tSection) tSection.style.display = 'block';
        toppings.forEach(top => {
            const label = document.createElement('label');
            label.className = 'option-label checkbox-label';
            const priceText = top.price > 0 ? `+¥${top.price}` : '無料';
            label.innerHTML = `
                <span>${top.name}</span>
                <span class="option-price">${priceText}</span>
                <input type="checkbox" name="topping-option" value="${top.id}" data-name="${top.name}" data-price="${top.price}">
            `;
            label.querySelector('input').addEventListener('change', () => {
                calculateDetailTotal();
                updateSelectionStyles(dom.itemDetailToppings);
            });
            dom.itemDetailToppings.appendChild(label);
        });
    }

    // 初期化
    updateSelectionStyles(dom.itemDetailOptions);
    updateSelectionStyles(dom.itemDetailFlavors);
    updateSelectionStyles(dom.itemDetailToppings);
    calculateDetailTotal();

    dom.itemDetailModal.classList.add('visible');
    dom.addToCartButton.disabled = false; // ボタン有効化
}

function handleOptionChange(group, sku) {
    if (!group.flavors || group.flavors.length === 0) return;
    const isLarge = sku && sku.includes('16');
    const inputs = dom.itemDetailFlavors.querySelectorAll('input');

    if (isLarge) {
        dom.flavorNote.textContent = '※2種類まで選択可能です。';
        inputs.forEach(input => {
            input.type = 'checkbox';
            input.name = 'flavor-option-check';
            input.onclick = (e) => {
                const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
                if (checked.length > 2) {
                    e.preventDefault();
                    showCustomAlert('選択制限', '味は2種類までしか選べません。');
                }
            };
        });
    } else {
        dom.flavorNote.textContent = '※味を1つ選んでください。';
        inputs.forEach(input => {
            input.type = 'radio';
            input.name = 'flavor-option-radio';
            input.onclick = null;
        });
        // リセット
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length > 1) {
            for(let i=1; i<checked.length; i++) checked[i].checked = false;
        }
    }
}

function updateSelectionStyles(container) {
    container.querySelectorAll('.option-label').forEach(label => {
        const input = label.querySelector('input');
        if (input && input.checked) label.classList.add('selected');
        else label.classList.remove('selected');
    });
}

function calculateDetailTotal() {
    const opt = dom.itemDetailOptions.querySelector('input:checked');
    const basePrice = opt ? parseInt(opt.dataset.price, 10) : 0;
    
    let toppingPrice = 0;
    dom.itemDetailToppings.querySelectorAll('input:checked').forEach(el => {
        toppingPrice += parseInt(el.dataset.price, 10);
    });
    
    const qty = parseInt(dom.itemDetailQuantity.textContent, 10);
    dom.itemDetailTotalPreview.textContent = (basePrice + toppingPrice) * qty;
}

function handleAddToCartClick() {
    if (!currentModalItem) return;

    const opt = dom.itemDetailOptions.querySelector('input:checked');
    if (!opt) { showCustomAlert('エラー', 'サイズを選択してください'); return; }

    let flavors = [];
    const fInputs = dom.itemDetailFlavors.querySelectorAll('input');
    if (fInputs.length > 0) {
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length === 0) { showCustomAlert('エラー', '味を選択してください'); return; }
        checked.forEach(el => flavors.push(el.value));
    }

    let toppings = [];
    dom.itemDetailToppings.querySelectorAll('input:checked').forEach(el => {
        toppings.push({ id: el.value, name: el.dataset.name, price: parseInt(el.dataset.price, 10) });
    });

    const qty = parseInt(dom.itemDetailQuantity.textContent, 10);
    
    const newItem = {
        groupId: currentModalItem.id,
        name: currentModalItem.name,
        sku: opt.value,
        optionName: opt.dataset.name,
        basePrice: parseInt(opt.dataset.price, 10),
        flavors: flavors,
        toppings: toppings,
        quantity: qty
    };

    addToCart(newItem);
    closeItemDetailModal();
}

function addToCart(newItem) {
    // ID生成
    const genKey = (item) => {
        const fStr = (Array.isArray(item.flavors) ? item.flavors.sort() : []).join('|');
        const tStr = item.toppings.map(t=>t.id).sort().join('|');
        return `${item.sku}_${fStr}_${tStr}`;
    };

    const key = genKey(newItem);
    const existing = cart.find(item => genKey(item) === key);

    if (existing) {
        existing.quantity += newItem.quantity;
    } else {
        const tPrice = newItem.toppings.reduce((s,t) => s + t.price, 0);
        newItem.unitPrice = newItem.basePrice + tPrice;
        cart.push(newItem);
    }
    updateCartView();
}

function updateCartView() {
    const count = cart.reduce((s,i) => s + i.quantity, 0);
    const total = cart.reduce((s,i) => s + (i.unitPrice * i.quantity), 0);
    dom.cartItemCount.textContent = count;
    dom.cartTotalPrice.textContent = total;
    dom.cartModalTotalPrice.textContent = total;
    dom.viewCartButton.disabled = count === 0;
}

// ★修正: カート表示を見やすく
function renderCartItems() {
    if (cart.length === 0) {
        dom.cartItemsContainer.innerHTML = '<p style="text-align:center;padding:2rem;color:#999">カートは空です 🛒</p>';
        dom.submitOrderButton.disabled = true;
        return;
    }
    dom.submitOrderButton.disabled = false;
    dom.cartItemsContainer.innerHTML = '';

    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        
        let detailsHtml = '';
        if (item.flavors && item.flavors.length > 0) {
            detailsHtml += `<div class="cart-detail-row"><span class="cart-detail-label">味:</span><span class="cart-detail-value">${item.flavors.join(' / ')}</span></div>`;
        }
        if (item.toppings && item.toppings.length > 0) {
            const tNames = item.toppings.map(t => t.name).join(' / ');
            detailsHtml += `<div class="cart-detail-row"><span class="cart-detail-label">追加:</span><span class="cart-detail-value">${tNames}</span></div>`;
        }

        div.innerHTML = `
            <div class="cart-item-header">
                <div class="cart-item-name">${item.name} (${item.optionName})</div>
                <div class="cart-item-total-price">¥${(item.unitPrice * item.quantity).toLocaleString()}</div>
            </div>
            <div class="cart-item-body">
                ${detailsHtml}
                <div class="cart-item-footer">
                    <div style="font-weight:bold;">数量: ${item.quantity}</div>
                    <button class="remove-item-btn" onclick="removeItemFromCart(${index})">削除</button>
                </div>
            </div>
        `;
        dom.cartItemsContainer.appendChild(div);
    });
}

function openCartModal() {
    renderCartItems();
    updatePickupTimeOptions();
    dom.cartModal.classList.add('visible');
}
function closeCartModal() { dom.cartModal.classList.remove('visible'); }

// ... (updatePickupTimeOptions, updateCategoryNav, confirmAndSubmitOrder などは前回と同じ) ...

function updatePickupTimeOptions() {
    const select = dom.pickupTime;
    if (!select) return;
    select.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = 'shortest'; opt.textContent = '最短希望';
    select.appendChild(opt);

    const now = new Date();
    const interval = parseInt(storeSettings.interval) || 5;
    const prep = parseInt(storeSettings.prep) || 30;

    const parseH = (s) => parseInt(s.split(':')[0], 10);
    const parseM = (s) => parseInt(s.split(':')[1], 10);
    const startH = parseH(storeSettings.open), startM = parseM(storeSettings.open);
    const endH = parseH(storeSettings.close), endM = parseM(storeSettings.close);

    const openDate = new Date(now); openDate.setHours(startH, startM, 0, 0);
    const closeDate = new Date(now); closeDate.setHours(endH, endM, 0, 0);
    const earliest = new Date(now.getTime() + prep * 60000);
    let t = (earliest > openDate) ? earliest : openDate;
    
    let m = t.getMinutes();
    let rem = m % interval;
    if(rem !== 0) t.setMinutes(m + (interval - rem));
    t.setSeconds(0); t.setMilliseconds(0);

    while (t <= closeDate) {
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');
        const val = `${hh}:${mm}`;
        const o = document.createElement('option');
        o.value = val; o.textContent = val;
        select.appendChild(o);
        t.setMinutes(t.getMinutes() + interval);
    }
}

// ... (以下、confirmAndSubmitOrder 等の後半部分は既存のロジックをそのまま利用してください)
// ※ 非常に長くなるため省略しますが、必ず元の app.js の confirmAndSubmitOrder, sendThanksMessage, showCustomAlert 等を含めてください。

window.removeItemFromCart = (index) => {
    cart.splice(index, 1);
    updateCartView();
    renderCartItems();
};

async function confirmAndSubmitOrder() {
    dom.submitOrderButton.disabled = true;
    dom.submitOrderButton.textContent = '送信中...';
    
    const recipientName = dom.recipientName.value.trim();
    if (!recipientName) {
        showCustomAlert('入力エラー', '受取人のお名前を入力してください');
        dom.submitOrderButton.disabled = false;
        dom.submitOrderButton.textContent = '注文を確定する';
        return;
    }

    const totalPrice = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    let pickupTime = dom.pickupTime.options[dom.pickupTime.selectedIndex].text;
    if (dom.pickupTime.value === 'shortest') pickupTime = '最短希望';

    const orderData = {
        userId: userProfile ? userProfile.userId : 'GUEST',
        displayName: userProfile ? userProfile.displayName : 'ゲスト',
        recipientName: recipientName,
        cart: cart,
        totalPrice: totalPrice,
        pickupTime: pickupTime,
        notes: dom.orderNotes.value.trim(),
        type: 'OSHIN_ORDER'
    };

    try {
        await fetch(BACKEND_URL, {
            method: 'POST', mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(orderData)
        });
        
        await sendThanksMessage(orderData);
        showCustomAlert('注文完了', 'ご注文ありがとうございます！\nLINEの通知をご確認ください。', () => liff.closeWindow());
    } catch(e) {
        showCustomAlert('エラー', '送信に失敗しました\n' + e.message);
        dom.submitOrderButton.disabled = false;
        dom.submitOrderButton.textContent = '注文を確定する';
    }
}

async function sendThanksMessage(orderData) {
  if (!liff.isInClient()) return;
  const items = orderData.cart.map(item => {
      let desc = item.optionName;
      if(item.flavors && item.flavors.length) desc += ` / ${item.flavors.join(',')}`;
      if(item.toppings && item.toppings.length) desc += ` / +${item.toppings.map(t=>t.name).join(',')}`;
      
      return {
          "type": "box", "layout": "vertical", "margin": "md",
          "contents": [
              { "type": "box", "layout": "horizontal", "contents": [
                  { "type": "text", "text": item.name, "weight": "bold", "flex": 3, "wrap": true },
                  { "type": "text", "text": `x${item.quantity}`, "align": "end", "flex": 1 }
              ]},
              { "type": "text", "text": desc, "size": "xs", "color": "#888888", "wrap": true }
          ]
      };
  });
  const contents = [
      { "type": "text", "text": `受取人: ${orderData.recipientName} 様`, "weight": "bold", "align": "center", "size": "md", "color": "#1e50a2" },
      { "type": "text", "text": `受取時間: ${orderData.pickupTime}`, "weight": "bold", "align": "center", "size": "lg", "margin": "sm" },
      { "type": "separator", "margin": "md" },
      ...items,
      { "type": "separator", "margin": "lg" },
      { "type": "box", "layout": "horizontal", "contents": [
          { "type": "text", "text": "合計金額", "weight": "bold" },
          { "type": "text", "text": `¥${orderData.totalPrice.toLocaleString()}`, "weight": "bold", "align": "end", "color": "#E64A19", "size": "lg" }
      ], "margin": "md"}
  ];
  if(orderData.notes) {
      contents.push({ "type": "separator", "margin": "md" });
      contents.push({ "type": "text", "text": `備考: ${orderData.notes}`, "size": "xs", "color": "#555", "wrap": true, "margin": "md" });
  }
  try {
    await liff.sendMessages([{
        "type": "flex", "altText": "ご注文ありがとうございます",
        "contents": {
            "type": "bubble",
            "header": { "type": "box", "layout": "vertical", "contents": [
                { "type": "text", "text": "粉もんスタンド おしん", "weight": "bold", "color": "#ffffff" },
                { "type": "text", "text": "ご注文承りました", "weight": "bold", "size": "xl", "color": "#ffffff", "margin": "sm" }
            ], "backgroundColor": "#E64A19" },
            "body": { "type": "box", "layout": "vertical", "contents": contents }
        }
    }]);
  } catch (e) { console.log(e); }
}

function updateCategoryNav(categories) {
    const nav = document.querySelector('.category-nav');
    if (!nav) return;
    nav.innerHTML = '';
    categories.forEach(cat => {
        const a = document.createElement('a');
        a.textContent = cat;
        a.onclick = (e) => {
            e.preventDefault();
            const target = document.getElementById(`cat-${cat}`);
            if (target) {
                const offset = target.getBoundingClientRect().top + window.pageYOffset - 70;
                window.scrollTo({ top: offset, behavior: 'smooth' });
            }
        };
        nav.appendChild(a);
    });
}

function showError(msg) { console.error(msg); if(dom.loading) dom.loading.innerHTML = `<p style="color:red;padding:20px;">${msg}</p>`; }
function showCustomAlert(title, msg, cb) {
    dom.customAlertTitle.textContent = title;
    dom.customAlertMessage.textContent = msg;
    dom.customAlertModal.classList.add('visible');
    dom.customAlertOkButton.onclick = () => { closeCustomAlert(); if(cb) cb(); };
}
function closeCustomAlert() { dom.customAlertModal.classList.remove('visible'); }
