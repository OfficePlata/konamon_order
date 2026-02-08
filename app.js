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
  // ★修正: 最優先でDOM要素を取得する（これでエラー時もローディング操作が可能になる）
  setupDOM(); 
  
  if (!LIFF_ID) return showError("LIFF ID未設定");
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return; }
    userProfile = await liff.getProfile();
    
    setupEventListeners(); // リスナー登録
    await fetchInitialData();
  } catch (err) { 
    showError(`初期化エラー: ${err.message}`); 
  } finally { 
    if(dom.loading) dom.loading.style.display = 'none'; 
  }
}

// DOM要素の取得を一箇所にまとめる
function setupDOM() {
    dom.loading = document.getElementById('loading');
    dom.menuContainer = document.getElementById('menu-container');
    
    // カート要素
    dom.viewCartButton = document.getElementById('view-cart-button');
    dom.cartItemCount = document.getElementById('cart-item-count');
    dom.cartTotalPrice = document.getElementById('cart-total-price');
    dom.cartModal = document.getElementById('cart-modal');
    dom.closeCartModal = document.getElementById('close-cart-modal');
    dom.submitOrderButton = document.getElementById('submit-order-button');
    dom.cartItemsContainer = document.getElementById('cart-items-container');
    dom.cartModalTotalPrice = document.getElementById('cart-modal-total-price');
    
    // 詳細モーダル要素
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
    
    // その他
    dom.customAlertModal = document.getElementById('custom-alert-modal');
    dom.customAlertTitle = document.getElementById('custom-alert-title');
    dom.customAlertMessage = document.getElementById('custom-alert-message');
    dom.customAlertOkButton = document.getElementById('custom-alert-ok-button');
    dom.pickupTime = document.getElementById('pickup-time');
    dom.orderNotes = document.getElementById('order-notes');
    dom.recipientName = document.getElementById('recipient-name');
}

// イベントリスナーの設定
function setupEventListeners() {
    if(dom.viewCartButton) dom.viewCartButton.addEventListener('click', openCartModal);
    if(dom.closeCartModal) dom.closeCartModal.addEventListener('click', closeCartModal);
    if(dom.cartModal) dom.cartModal.addEventListener('click', (e) => { if (e.target === dom.cartModal) closeCartModal(); });
    
    if(dom.closeItemDetailModal) dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    if(dom.itemDetailModal) dom.itemDetailModal.addEventListener('click', (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); });

    if(dom.submitOrderButton) dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);

    // 数量ボタン
    if(dom.itemDetailDecrease) {
        dom.itemDetailDecrease.addEventListener('click', () => {
            let q = parseInt(dom.itemDetailQuantity.textContent, 10);
            if (q > 1) {
                dom.itemDetailQuantity.textContent = q - 1;
                calculateDetailTotal();
            }
        });
    }
    if(dom.itemDetailIncrease) {
        dom.itemDetailIncrease.addEventListener('click', () => {
            let q = parseInt(dom.itemDetailQuantity.textContent, 10);
            dom.itemDetailQuantity.textContent = q + 1;
            calculateDetailTotal();
        });
    }

    // カートへ追加ボタン
    if(dom.addToCartButton) dom.addToCartButton.addEventListener('click', handleAddToCartClick);
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) {
             const text = await response.text();
             throw new Error(`Server Error: ${response.status} - ${text.substring(0, 100)}`);
        }
        
        let data;
        try { data = await response.json(); } 
        catch (e) { throw new Error('データ形式エラー(JSON)'); }

        if (data.menu && Array.isArray(data.menu)) {
            menuData = data.menu;
            if (data.settings) storeSettings = { ...storeSettings, ...data.settings };
            displayMenu();
        } else { throw new Error('メニューデータ不正'); }
    } catch (err) {
        console.error(err);
        showCustomAlert("通信エラー", `メニューを読み込めませんでした。\n(${err.message})`);
        menuData = FALLBACK_MENU_DATA;
        displayMenu();
    }
}

function displayMenu() {
  dom.menuContainer.innerHTML = '';
  if (!menuData || menuData.length === 0) {
      dom.menuContainer.innerHTML = '<p style="padding:1rem;">メニューがありません。</p>';
      return;
  }

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
        if (group.options && Array.isArray(group.options) && group.options.length > 0) {
            const validPrices = group.options
                .map(o => o.price)
                .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
            if (validPrices.length > 0) {
                const min = Math.min(...validPrices);
                priceText = `¥${min}〜`;
            }
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
        // カードクリック時のイベントリスナー
        card.addEventListener('click', () => showItemDetailModal(group));
        dom.menuContainer.appendChild(card);
      });
  });
}

function updateCategoryNav(categories) {
    const nav = document.querySelector('.category-nav');
    if (!nav) return;
    nav.innerHTML = '';
    categories.forEach(cat => {
        const a = document.createElement('a');
        a.href = `#cat-${cat}`;
        a.textContent = cat;
        a.onclick = (e) => {
            e.preventDefault();
            const target = document.getElementById(`cat-${cat}`);
            if (target) {
                const headerOffset = 60;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }
        };
        nav.appendChild(a);
    });
}

// --- 詳細モーダル処理 ---

function showItemDetailModal(group) {
    currentModalItem = group;

    dom.itemDetailName.textContent = group.name;
    const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
    dom.itemDetailImg.src = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;
    dom.itemDetailDescription.textContent = group.description || '';
    dom.itemDetailQuantity.textContent = '1';

    // 1. オプション（サイズ）生成
    dom.itemDetailOptions.innerHTML = '';
    if (group.options && Array.isArray(group.options) && group.options.length > 0) {
        group.options.forEach((opt, index) => {
            const label = document.createElement('label');
            label.className = 'option-label';
            const checked = index === 0 ? 'checked' : '';
            label.innerHTML = `
                <span>${opt.name}</span>
                <span class="option-price">¥${opt.price}</span>
                <input type="radio" name="price-option" value="${opt.sku}" data-name="${opt.name}" data-price="${opt.price}" ${checked}>
            `;
            // イベント設定
            label.querySelector('input').addEventListener('change', () => {
                handleOptionChange(group, opt.sku);
                calculateDetailTotal();
                updateSelectionStyles(dom.itemDetailOptions);
            });
            dom.itemDetailOptions.appendChild(label);
        });
    } else {
        dom.itemDetailOptions.innerHTML = '<p style="color:red">オプション情報がありません</p>';
    }

    // 2. フレーバー生成
    dom.itemDetailFlavors.innerHTML = '';
    if (group.flavors && group.flavors.length > 0 && group.flavors[0] !== "") {
        dom.sectionFlavors.style.display = 'block';
        group.flavors.forEach(flavor => {
            if(!flavor) return;
            const label = document.createElement('label');
            label.className = 'option-label';
            label.innerHTML = `
                <span>${flavor}</span>
                <input type="radio" name="flavor-option" value="${flavor}">
            `;
            label.querySelector('input').addEventListener('change', () => {
                calculateDetailTotal();
                updateSelectionStyles(dom.itemDetailFlavors);
            });
            dom.itemDetailFlavors.appendChild(label);
        });
        
        if (group.options && group.options.length > 0) {
            handleOptionChange(group, group.options[0].sku);
        }
    } else {
        dom.sectionFlavors.style.display = 'none';
    }

    // 3. トッピング生成
    dom.itemDetailToppings.innerHTML = '';
    const toppings = group.toppings || [];
    const toppingSection = document.getElementById('item-detail-toppings').closest('.option-section');
    
    if (toppings.length === 0) {
        if (toppingSection) toppingSection.style.display = 'none';
    } else {
        if (toppingSection) toppingSection.style.display = 'block';
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

    updateSelectionStyles(dom.itemDetailOptions);
    updateSelectionStyles(dom.itemDetailFlavors);
    updateSelectionStyles(dom.itemDetailToppings);
    calculateDetailTotal();

    dom.itemDetailModal.classList.add('visible');
    dom.addToCartButton.disabled = false;
}

function handleOptionChange(group, sku) {
    if (!group.flavors || group.flavors.length === 0) return;

    const isLargePortion = sku && sku.includes('16'); // 簡易判定
    const inputs = dom.itemDetailFlavors.querySelectorAll('input');

    inputs.forEach(input => {
        if (isLargePortion) {
            dom.flavorNote.textContent = '※2種類まで選択可能です。';
            input.type = 'checkbox';
            input.name = 'flavor-option-check';
            input.onclick = (e) => {
                const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
                if (checked.length > 2) {
                    e.preventDefault();
                    showCustomAlert('選択制限', '味は2種類までしか選べません。');
                }
            };
        } else {
            dom.flavorNote.textContent = '※味を1つ選んでください。';
            input.type = 'radio';
            input.name = 'flavor-option-radio';
            input.onclick = null;
        }
    });
    
    // ラジオボタンへの切り替え時に複数選択されていたらリセット
    if (!isLargePortion) {
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length > 1) {
            for (let i = 1; i < checked.length; i++) checked[i].checked = false;
        }
    }
    updateSelectionStyles(dom.itemDetailFlavors);
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

// カート追加
function handleAddToCartClick() {
    if (!currentModalItem) return;

    const opt = dom.itemDetailOptions.querySelector('input:checked');
    if (!opt) { showCustomAlert('選択エラー', 'サイズ/個数を選択してください'); return; }

    let flavors = [];
    const fInputs = dom.itemDetailFlavors.querySelectorAll('input');
    if (fInputs.length > 0) {
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length === 0) { showCustomAlert('選択エラー', '味を選択してください'); return; }
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
    // 厳密な同一性チェック
    const genKey = (item) => {
        const fStr = (Array.isArray(item.flavors) ? item.flavors.sort() : []).join('|');
        const tStr = item.toppings.map(t=>t.id).sort().join('|');
        return `${item.sku}_${fStr}_${tStr}`;
    };

    const newKey = genKey(newItem);
    const existingIndex = cart.findIndex(item => genKey(item) === newKey);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += newItem.quantity;
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

function openCartModal() {
    renderCartItems();
    updatePickupTimeOptions();
    dom.cartModal.classList.add('visible');
}
function closeCartModal() { dom.cartModal.classList.remove('visible'); }

function renderCartItems() {
    if (cart.length === 0) {
        dom.cartItemsContainer.innerHTML = '<p style="text-align:center; padding:2rem; color:#888;">カートは空です 🛒</p>';
        dom.submitOrderButton.disabled = true;
        return;
    }
    dom.submitOrderButton.disabled = false;
    dom.cartItemsContainer.innerHTML = '';

    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        
        let meta = `<div style="font-weight:bold; color:#1e50a2;">${item.optionName}</div>`;
        if (item.flavors && item.flavors.length > 0) {
            meta += `<div style="font-size:0.9em;">味: ${item.flavors.join(' / ')}</div>`;
        }
        if (item.toppings && item.toppings.length > 0) {
            meta += `<div style="font-size:0.85em; color:#E64A19;">+ ${item.toppings.map(t=>t.name).join(', ')}</div>`;
        }

        div.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                ${meta}
                <div class="cart-item-price">¥${item.unitPrice.toLocaleString()} × ${item.quantity}</div>
            </div>
            <div class="cart-item-actions">
                <div style="font-weight:bold; font-size:1.1em;">¥${(item.unitPrice * item.quantity).toLocaleString()}</div>
                <button class="remove-item-btn" onclick="removeItemFromCart(${index})">削除</button>
            </div>
        `;
        dom.cartItemsContainer.appendChild(div);
    });
}

// グローバル関数（削除ボタン用）
window.removeItemFromCart = (index) => {
    cart.splice(index, 1);
    updateCartView();
    renderCartItems();
};

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
    currentModalItem = null;
}

// 受取時間生成
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

// 注文送信
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
    
    let pickupTime = dom.pickupTime.options[dom.pickupTime.selectedIndex].text;
    if (dom.pickupTime.value === 'shortest') pickupTime = '最短希望';
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const orderData = {
        userId: userProfile ? userProfile.userId : 'GUEST',
        displayName: userProfile ? userProfile.displayName : 'ゲスト',
        recipientName: recipientName,
        pickupTime: pickupTime,
        notes: dom.orderNotes.value.trim(),
        totalPrice: totalPrice,
        cart: cart, 
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

function showError(msg) { console.error(msg); if(dom.loading) dom.loading.innerHTML = `<p style="color:red;padding:20px;">${msg}</p>`; }
function showCustomAlert(title, msg, cb) {
    dom.customAlertTitle.textContent = title;
    dom.customAlertMessage.textContent = msg;
    dom.customAlertModal.classList.add('visible');
    dom.customAlertOkButton.onclick = () => { closeCustomAlert(); if(cb) cb(); };
}
function closeCustomAlert() { dom.customAlertModal.classList.remove('visible'); }
