document.addEventListener('DOMContentLoaded', initializeApp);

const LIFF_ID = "2009023539-6ANIeNDa"; 
// ★デプロイ後に発行された新しいURLに書き換えてください
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 

let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 15 };
let currentModalItem = null; // 現在開いている商品データ

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
    setupDOM(); // DOM要素の取得
    setupStaticListeners(); // 静的なイベント設定
    await fetchInitialData();
  } catch (err) { showError(`初期化エラー: ${err.message}`); } 
  finally { if(dom.loading) dom.loading.style.display = 'none'; }
}

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

function setupStaticListeners() {
    // カート開閉
    dom.viewCartButton.addEventListener('click', openCartModal);
    dom.closeCartModal.addEventListener('click', closeCartModal);
    dom.cartModal.addEventListener('click', (e) => { if (e.target === dom.cartModal) closeCartModal(); });
    
    // 詳細モーダル閉じる
    dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    dom.itemDetailModal.addEventListener('click', (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); });

    // 注文確定
    dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);
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
        // キャッシュバスター
        const imgDisplayUrl = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;

        card.innerHTML = `
            <img src="${imgDisplayUrl}" alt="${group.name}" onerror="this.src='https://placehold.co/300x200/eee/ccc?text=No+Image'">
            <div class="item-info">
                <p class="item-name">${group.name}</p>
                <p class="item-price">${priceText}</p>
            </div>
        `;
        // ★重要: ここでクリックイベントを設定
        card.onclick = () => showItemDetailModal(group);
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
                const offset = target.getBoundingClientRect().top + window.pageYOffset - 70;
                window.scrollTo({ top: offset, behavior: "smooth" });
            }
        };
        nav.appendChild(a);
    });
}

// --- 詳細モーダル ---
function showItemDetailModal(group) {
    currentModalItem = group; // 現在の商品をセット

    // 表示リセット
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
            // ★イベント設定: changeで再計算
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
            // 初期はラジオボタン
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
        // 初期状態のロジック適用
        if(group.options && group.options.length > 0) {
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

    // ★重要: ボタンのイベントをここで設定（onclickを上書きすることで重複防止）
    dom.itemDetailDecrease.onclick = () => {
        let q = parseInt(dom.itemDetailQuantity.textContent, 10);
        if (q > 1) {
            dom.itemDetailQuantity.textContent = q - 1;
            calculateDetailTotal();
        }
    };
    dom.itemDetailIncrease.onclick = () => {
        let q = parseInt(dom.itemDetailQuantity.textContent, 10);
        dom.itemDetailQuantity.textContent = q + 1;
        calculateDetailTotal();
    };
    
    // ★カート追加ボタンのイベント設定
    dom.addToCartButton.onclick = handleAddToCartClick;
    dom.addToCartButton.disabled = false; // 有効化

    // 初期計算と表示
    updateSelectionStyles(dom.itemDetailOptions);
    updateSelectionStyles(dom.itemDetailFlavors);
    updateSelectionStyles(dom.itemDetailToppings);
    calculateDetailTotal();

    dom.itemDetailModal.classList.add('visible');
}

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
    currentModalItem = null;
}

// オプション変更時のロジック（16個入りなどの特殊対応）
function handleOptionChange(group, sku) {
    if (!group.flavors || group.flavors.length === 0) return;

    const isLargePortion = sku && sku.includes('16'); // 簡易判定
    const inputs = dom.itemDetailFlavors.querySelectorAll('input');

    if (isLargePortion) {
        dom.flavorNote.textContent = '※2種類まで選択可能です。';
        inputs.forEach(input => {
            input.type = 'checkbox';
            input.name = 'flavor-option-check';
            // Checkbox用の制限ロジック
            input.onclick = (e) => {
                const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
                if (checked.length > 2) {
                    e.preventDefault(); // チェックを阻止
                    showCustomAlert('選択制限', '味は2種類までしか選べません。');
                }
            };
        });
    } else {
        dom.flavorNote.textContent = '※味を1つ選んでください。';
        inputs.forEach(input => {
            input.type = 'radio';
            input.name = 'flavor-option-radio';
            input.onclick = null; // 制限解除
        });
        // 複数選択されていたらリセット
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length > 1) {
            for(let i=1; i<checked.length; i++) checked[i].checked = false;
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
    const option = dom.itemDetailOptions.querySelector('input:checked');
    const basePrice = option ? parseInt(option.dataset.price, 10) : 0;
    
    let toppingPrice = 0;
    dom.itemDetailToppings.querySelectorAll('input:checked').forEach(el => {
        toppingPrice += parseInt(el.dataset.price, 10);
    });
    
    const quantity = parseInt(dom.itemDetailQuantity.textContent, 10);
    const total = (basePrice + toppingPrice) * quantity;
    dom.itemDetailTotalPreview.textContent = total;
}

// カート追加ロジック
function handleAddToCartClick() {
    if (!currentModalItem) return;

    // バリデーション
    const selectedOption = dom.itemDetailOptions.querySelector('input:checked');
    if (!selectedOption) {
        showCustomAlert('選択エラー', 'サイズ/個数を選択してください。');
        return;
    }

    let selectedFlavors = [];
    const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input');
    if (flavorInputs.length > 0) {
        const checkedFlavors = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checkedFlavors.length === 0) {
            showCustomAlert('選択エラー', '味を選択してください。');
            return;
        }
        checkedFlavors.forEach(el => selectedFlavors.push(el.value));
    }

    let selectedToppings = [];
    dom.itemDetailToppings.querySelectorAll('input:checked').forEach(el => {
        selectedToppings.push({
            id: el.value,
            name: el.dataset.name,
            price: parseInt(el.dataset.price, 10)
        });
    });

    const quantity = parseInt(dom.itemDetailQuantity.textContent, 10);

    const newItem = {
        groupId: currentModalItem.id,
        name: currentModalItem.name,
        sku: selectedOption.value,
        optionName: selectedOption.dataset.name,
        basePrice: parseInt(selectedOption.dataset.price, 10),
        flavors: selectedFlavors, // 配列
        toppings: selectedToppings, // 配列
        quantity: quantity
    };

    addToCart(newItem);
    closeItemDetailModal();
}

function addToCart(newItem) {
    // 厳密な同一性チェック用キー作成
    const genKey = (item) => {
        const fKey = Array.isArray(item.flavors) ? item.flavors.sort().join('|') : '';
        const tKey = item.toppings.map(t => t.id).sort().join('|');
        return `${item.sku}_${fKey}_${tKey}`;
    };

    const newKey = genKey(newItem);
    const existingIndex = cart.findIndex(item => genKey(item) === newKey);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += newItem.quantity;
    } else {
        // 単価計算
        let toppingSum = newItem.toppings.reduce((sum, t) => sum + t.price, 0);
        newItem.unitPrice = newItem.basePrice + toppingSum;
        cart.push(newItem);
    }
    updateCartView();
}

function updateCartView() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    dom.cartItemCount.textContent = totalItems;
    dom.cartTotalPrice.textContent = totalPrice;
    dom.cartModalTotalPrice.textContent = totalPrice;
    dom.viewCartButton.disabled = cart.length === 0;
}

function openCartModal() {
    renderCartItems();
    updatePickupTimeOptions();
    dom.cartModal.classList.add('visible');
}
function closeCartModal() { dom.cartModal.classList.remove('visible'); }

// ★カート表示の見やすさ改善
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
        
        let flavorHtml = '';
        if (item.flavors && item.flavors.length > 0) {
            flavorHtml = `<div class="cart-item-flavor">味: ${item.flavors.join(' / ')}</div>`;
        }
        
        let toppingHtml = '';
        if (item.toppings && item.toppings.length > 0) {
            toppingHtml = `<div class="cart-item-toppings">` + 
                item.toppings.map(t => `<span>+ ${t.name}</span>`).join('') + 
                `</div>`;
        }

        div.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-option">${item.optionName}</div>
                ${flavorHtml}
                ${toppingHtml}
                <div class="cart-item-price">¥${item.unitPrice.toLocaleString()}</div>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-display">x ${item.quantity}</div>
                <div class="subtotal">¥${(item.unitPrice * item.quantity).toLocaleString()}</div>
                <button class="remove-item-btn" onclick="removeItemFromCart(${index})">削除</button>
            </div>
        `;
        dom.cartItemsContainer.appendChild(div);
    });
}

window.removeItemFromCart = (index) => {
    cart.splice(index, 1);
    updateCartView();
    renderCartItems();
};

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

    // 時間パース (HH:mm)
    const parseH = (s) => parseInt(s.split(':')[0], 10);
    const parseM = (s) => parseInt(s.split(':')[1], 10);
    
    const startH = parseH(storeSettings.open), startM = parseM(storeSettings.open);
    const endH = parseH(storeSettings.close), endM = parseM(storeSettings.close);

    const openDate = new Date(now); openDate.setHours(startH, startM, 0, 0);
    const closeDate = new Date(now); closeDate.setHours(endH, endM, 0, 0);
    
    // 最短受取可能時刻 = 現在 + 準備時間
    const earliest = new Date(now.getTime() + prep * 60000);
    
    // リスト開始時刻 = max(営業開始, 最短受取) の直後のインターバル
    let t = (earliest > openDate) ? earliest : openDate;
    
    // 分を丸める
    let m = t.getMinutes();
    let rem = m % interval;
    if (rem !== 0) t.setMinutes(m + (interval - rem));
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
  
  // Flex Message用アイテム生成
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
