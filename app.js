document.addEventListener('DOMContentLoaded', initializeApp);

// --- ▼▼▼ 設定項目 ▼▼▼ ---
const LIFF_ID = "2009023539-6ANIeNDa"; 
// GASのURL (デプロイ後に発行されたURLを確認してください)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 
// --- ▲▲▲ 設定項目 ▲▲▲ ---

let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 15 };

const dom = {}; 

// フォールバック用データ
const FALLBACK_MENU_DATA = [
    {
        id: 'error_fallback', category: 'お知らせ', name: 'メニュー読込エラー',
        description: 'メニューの読み込みに失敗しました。画面をリロードしてください。',
        imageUrl: 'https://placehold.co/300x200/ccc/333?text=Error',
        options: [{ sku: 'err', name: '-', price: 0 }],
        toppings: []
    }
];

async function initializeApp() {
  if (!LIFF_ID) {
    showError("LIFF_ID が設定されていません。");
    return;
  }
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    userProfile = await liff.getProfile();
    setupEventListeners();
    await fetchInitialData();
  } catch (err) {
    showError(`初期化エラー: ${err.message}`);
  } finally {
    if(dom.loading) dom.loading.style.display = 'none';
  }
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server Error: ${response.status} - ${text.substring(0, 100)}`);
        }
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('データの形式が正しくありません(JSON Parse Error)');
        }
        
        if (data.menu && Array.isArray(data.menu)) {
            menuData = data.menu;
            if (data.settings) {
                storeSettings = { ...storeSettings, ...data.settings };
            }
            displayMenu();
        } else {
            throw new Error('メニューデータの形式が不正です');
        }
    } catch (err) {
        console.error("メニュー取得失敗:", err);
        showCustomAlert("通信エラー", `メニューの読み込みに失敗しました。\n(${err.message})\n\n電波の良い場所で再度お試しください。`);
        menuData = FALLBACK_MENU_DATA;
        displayMenu();
    }
}


function setupEventListeners() {
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

    dom.viewCartButton.addEventListener('click', openCartModal);
    dom.closeCartModal.addEventListener('click', closeCartModal);
    dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);
    dom.cartModal.addEventListener('click', (e) => { if (e.target === dom.cartModal) closeCartModal(); });
    dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    dom.itemDetailModal.addEventListener('click', (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); });
}

function displayMenu() {
  dom.menuContainer.innerHTML = '';
  
  // 安全策: menuDataがnull/undefinedの場合のガード
  if (!menuData || !Array.isArray(menuData) || menuData.length === 0) {
      dom.menuContainer.innerHTML = '<p style="padding:1rem;">メニューがありません。</p>';
      return;
  }

  // カテゴリ一覧の生成（itemが有効な場合のみ）
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
        
        // ★修正ポイント: optionsのチェックを厳密に
        let minPrice = 0;
        if (group.options && Array.isArray(group.options) && group.options.length > 0) {
            // 価格があるものだけ抽出して最小値を探す
            const prices = group.options.map(opt => opt.price).filter(p => typeof p === 'number');
            if (prices.length > 0) {
                minPrice = Math.min(...prices);
            }
        }

        const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';

        card.innerHTML = `
            <img src="${imgUrl}" alt="${group.name}" onerror="this.src='https://placehold.co/300x200/eee/ccc?text=No+Image'">
            <div class="item-info">
                <p class="item-name">${group.name}</p>
                <p class="item-price">¥${minPrice}〜</p>
            </div>
        `;
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
                const headerOffset = 60;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }
        };
        nav.appendChild(a);
    });
}

function showItemDetailModal(group) {
    dom.itemDetailName.textContent = group.name;
    dom.itemDetailImg.src = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
    dom.itemDetailDescription.textContent = group.description || '';
    
    dom.itemDetailOptions.innerHTML = '';
    let isFirstOption = true;
    
    // optionsが有効な配列かチェック
    if (group.options && Array.isArray(group.options) && group.options.length > 0) {
        group.options.forEach(opt => {
            const label = document.createElement('label');
            label.className = 'option-label';
            label.onchange = (e) => {
                handleOptionChange(group, e.target.value);
                calculateDetailTotal();
            };
            label.innerHTML = `
                <span>${opt.name}</span>
                <span class="option-price">¥${opt.price}</span>
                <input type="radio" name="price-option" value="${opt.sku}" data-name="${opt.name}" data-price="${opt.price}">
            `;
            if (isFirstOption) {
                label.querySelector('input').checked = true;
                isFirstOption = false;
            }
            dom.itemDetailOptions.appendChild(label);
        });
    } else {
        dom.itemDetailOptions.innerHTML = '<p style="color:red; font-size:0.9rem;">オプション情報がありません</p>';
    }

    dom.itemDetailFlavors.innerHTML = '';
    if (group.flavors && group.flavors.length > 0) {
        dom.sectionFlavors.style.display = 'block';
        group.flavors.forEach(flavor => {
            const label = document.createElement('label');
            label.className = 'option-label';
            label.innerHTML = `
                <span>${flavor}</span>
                <input type="radio" name="flavor-option" value="${flavor}">
            `;
            dom.itemDetailFlavors.appendChild(label);
        });
        // オプションが存在する場合のみ呼び出す
        if(group.options && group.options.length > 0) {
            handleOptionChange(group, group.options[0].sku);
        }
    } else {
        dom.sectionFlavors.style.display = 'none';
    }

    dom.itemDetailToppings.innerHTML = '';
    const toppings = group.toppings || [];
    
    if (toppings.length === 0) {
        // 親要素(option-section)を探して非表示にする
        const section = document.getElementById('item-detail-toppings').closest('.option-section');
        if(section) section.style.display = 'none';
    } else {
        const section = document.getElementById('item-detail-toppings').closest('.option-section');
        if(section) section.style.display = 'block';
        
        toppings.forEach(top => {
            const label = document.createElement('label');
            label.className = 'option-label checkbox-label';
            label.onchange = calculateDetailTotal;
            const priceText = top.price > 0 ? `+¥${top.price}` : '無料';
            label.innerHTML = `
                <span>${top.name}</span>
                <span class="option-price">${priceText}</span>
                <input type="checkbox" name="topping-option" value="${top.id}" data-name="${top.name}" data-price="${top.price}">
            `;
            dom.itemDetailToppings.appendChild(label);
        });
    }

    let quantity = 1;
    dom.itemDetailQuantity.textContent = quantity;
    
    const setupButton = (btn, callback) => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = callback;
        return newBtn;
    };
    
    dom.itemDetailDecrease = setupButton(dom.itemDetailDecrease, () => {
        if (quantity > 1) { quantity--; dom.itemDetailQuantity.textContent = quantity; calculateDetailTotal(); }
    });
    dom.itemDetailIncrease = setupButton(dom.itemDetailIncrease, () => {
        quantity++; dom.itemDetailQuantity.textContent = quantity; calculateDetailTotal();
    });

    dom.addToCartButton = setupButton(dom.addToCartButton, () => {
        const selectedOptionEl = dom.itemDetailOptions.querySelector('input[name="price-option"]:checked');
        if (!selectedOptionEl) {
            showCustomAlert('選択エラー', 'サイズ/個数を選択してください。');
            return;
        }

        let selectedFlavors = [];
        if (group.flavors && group.flavors.length > 0) {
            const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input:checked');
            if (flavorInputs.length === 0) {
                showCustomAlert('選択エラー', '味を選択してください。');
                return;
            }
            flavorInputs.forEach(input => selectedFlavors.push(input.value));
        }
        
        const selectedToppings = [];
        const toppingEls = dom.itemDetailToppings.querySelectorAll('input[name="topping-option"]:checked');
        toppingEls.forEach(el => {
            selectedToppings.push({
                id: el.value,
                name: el.dataset.name,
                price: parseInt(el.dataset.price, 10)
            });
        });

        const itemData = {
            groupId: group.id,
            name: group.name,
            sku: selectedOptionEl.value,
            optionName: selectedOptionEl.dataset.name,
            basePrice: parseInt(selectedOptionEl.dataset.price, 10),
            flavors: selectedFlavors,
            toppings: selectedToppings,
            quantity: quantity
        };
        
        addToCart(itemData);
        closeItemDetailModal();
    });

    calculateDetailTotal();
    dom.itemDetailModal.classList.add('visible');
}

function handleOptionChange(group, sku) {
    if (!group.flavors || group.flavors.length === 0) return;

    const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input');
    const isLargePortion = sku.includes('16'); 

    if (isLargePortion) {
        dom.flavorNote.textContent = '※2種類まで選択可能です。1種類でもOKです。';
        flavorInputs.forEach(input => {
            input.type = 'checkbox';
            input.name = 'flavor-option-check';
            input.onchange = limitFlavorSelection;
        });
    } else {
        dom.flavorNote.textContent = '※味を1つ選んでください。';
        flavorInputs.forEach(input => {
            input.type = 'radio';
            input.name = 'flavor-option-radio';
            input.onchange = null;
        });
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length > 1) {
            checked.forEach(c => c.checked = false);
            if(checked[0]) checked[0].checked = true;
        }
    }
}

function limitFlavorSelection(e) {
    const checked = dom.itemDetailFlavors.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length > 2) {
        e.target.checked = false;
        showCustomAlert('選択制限', '味は2種類までしか選べません。');
    }
}

function calculateDetailTotal() {
    const selectedOptionEl = dom.itemDetailOptions.querySelector('input[name="price-option"]:checked');
    const basePrice = selectedOptionEl ? parseInt(selectedOptionEl.dataset.price, 10) : 0;

    let toppingPrice = 0;
    const toppingEls = dom.itemDetailToppings.querySelectorAll('input[name="topping-option"]:checked');
    toppingEls.forEach(el => toppingPrice += parseInt(el.dataset.price, 10));

    const quantity = parseInt(dom.itemDetailQuantity.textContent, 10);
    const total = (basePrice + toppingPrice) * quantity;
    dom.itemDetailTotalPreview.textContent = total;
}

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
}

function addToCart(newItem) {
  const newItemToppingId = newItem.toppings.map(t => t.id).sort().join(',');
  const newItemFlavors = newItem.flavors ? newItem.flavors.sort().join(',') : '';

  const existingItemIndex = cart.findIndex(cartItem => {
      const cartItemToppingId = cartItem.toppings.map(t => t.id).sort().join(',');
      const cartItemFlavors = cartItem.flavors ? cartItem.flavors.sort().join(',') : '';
      
      return cartItem.sku === newItem.sku && 
             cartItemToppingId === newItemToppingId &&
             cartItemFlavors === newItemFlavors;
  });

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += newItem.quantity;
  } else {
    const unitPrice = newItem.basePrice + newItem.toppings.reduce((sum, t) => sum + t.price, 0);
    cart.push({
      ...newItem,
      unitPrice: unitPrice
    });
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

function updatePickupTimeOptions() {
    const select = dom.pickupTime;
    if (!select) return;
    
    select.innerHTML = '';
    
    const shortestOpt = document.createElement('option');
    shortestOpt.value = 'shortest';
    shortestOpt.textContent = '最短希望';
    select.appendChild(shortestOpt);

    const now = new Date();
    const config = storeSettings;
    const interval = parseInt(config.interval) || 15;
    const prep = parseInt(config.prep) || 30;

    const parseTime = (val, def) => {
        const m = String(val).match(/(\d{1,2}):(\d{2})/);
        return m ? { h: parseInt(m[1], 10), m: parseInt(m[2], 10) } : def;
    };

    const openT = parseTime(config.open, { h: 11, m: 0 });
    const closeT = parseTime(config.close, { h: 21, m: 0 });

    const openDate = new Date(now);
    openDate.setHours(openT.h, openT.m, 0, 0);

    const closeDate = new Date(now);
    closeDate.setHours(closeT.h, closeT.m, 0, 0);

    const earliest = new Date(now.getTime() + prep * 60000);
    let startTime = (earliest > openDate) ? earliest : openDate;
    
    let currentSlot = new Date(startTime);
    const remainder = currentSlot.getMinutes() % interval;
    if (remainder !== 0) {
        currentSlot.setMinutes(currentSlot.getMinutes() + (interval - remainder));
    }
    currentSlot.setSeconds(0);
    currentSlot.setMilliseconds(0);

    while (currentSlot <= closeDate) {
        const hours = currentSlot.getHours().toString().padStart(2, '0');
        const minutes = currentSlot.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        const option = document.createElement('option');
        option.value = timeStr;
        option.textContent = timeStr;
        select.appendChild(option);
        currentSlot.setMinutes(currentSlot.getMinutes() + interval);
    }
}

function closeCartModal() {
  dom.cartModal.classList.remove('visible');
}

function renderCartItems() {
  if (cart.length === 0) {
    dom.cartItemsContainer.innerHTML = '<p>カートは空です。</p>';
    dom.submitOrderButton.disabled = true;
    return;
  }
  dom.submitOrderButton.disabled = false;
  dom.cartItemsContainer.innerHTML = '';
  
  cart.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    
    let metaText = item.optionName;
    if (item.flavors && item.flavors.length > 0) {
        metaText += ` / ${item.flavors.join('・')}`;
    }

    const toppingStr = item.toppings.length > 0 
        ? `<div class="cart-item-toppings">+ ${item.toppings.map(t => t.name).join(', ')}</div>` 
        : '';

    itemEl.innerHTML = `
        <div class="cart-item-details">
            <p class="cart-item-name">${item.name}</p>
            <p class="cart-item-meta">${metaText}</p>
            ${toppingStr}
            <p class="cart-item-price">@¥${item.unitPrice} × ${item.quantity} = ¥${item.unitPrice * item.quantity}</p>
        </div>
        <div class="cart-item-actions">
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateItemQuantity(${index}, -1)">-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateItemQuantity(${index}, 1)">+</button>
            </div>
            <button class="remove-item-btn" onclick="removeItemFromCart(${index})">&times;</button>
        </div>
    `;
    dom.cartItemsContainer.appendChild(itemEl);
  });
  updateCartView();
}

window.updateItemQuantity = (index, change) => {
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  renderCartItems();
};

window.removeItemFromCart = (index) => {
  cart.splice(index, 1);
  renderCartItems();
};

async function confirmAndSubmitOrder() {
  dom.submitOrderButton.disabled = true;
  dom.submitOrderButton.textContent = '注文処理中...';
  
  const totalPrice = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  
  let pickupTime = dom.pickupTime.options[dom.pickupTime.selectedIndex].text;
  if (dom.pickupTime.value === 'shortest') {
      pickupTime = '最短希望';
  }

  const notes = dom.orderNotes ? dom.orderNotes.value.trim() : '';

  const orderData = {
    userId: userProfile ? userProfile.userId : 'GUEST', 
    displayName: userProfile ? userProfile.displayName : 'ゲスト',
    cart: cart.map(item => ({ 
        name: item.name,
        option: item.optionName,
        flavors: item.flavors ? item.flavors.join(',') : '',
        toppings: item.toppings.map(t => t.name).join(', '),
        quantity: item.quantity,
        price: item.unitPrice
    })),
    totalPrice: totalPrice,
    pickupTime: pickupTime,
    notes: notes, 
    type: "OSHIN_ORDER"
  };

  try {
    await fetch(BACKEND_URL, {
      method: 'POST', mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    
    await sendThanksMessage(orderData);
    showCustomAlert('注文完了', 'ご注文ありがとうございます！\nお店でお待ちしております。', () => liff.closeWindow());

  } catch (err) {
    showCustomAlert('注文エラー', `通信エラーが発生しましたが、注文が送信された可能性があります。\n念のため店頭でご確認ください。\n(${err.message})`);
    dom.submitOrderButton.disabled = false;
    dom.submitOrderButton.textContent = '注文を確定する';
  }
}

async function sendThanksMessage(orderData) {
  if (!liff.isInClient()) return;
  const flexMessage = createReceiptFlexMessage(orderData);
  try {
    await liff.sendMessages([flexMessage]);
  } catch (err) {
    console.error('メッセージ送信失敗:', err);
  }
}

function createReceiptFlexMessage(orderData) {
    const itemDetails = orderData.cart.map(item => {
        let details = item.option;
        if(item.flavors) details += ` / ${item.flavors}`;
        if(item.toppings) details += ` / ${item.toppings}`;

        return {
            "type": "box", "layout": "vertical", "margin": "md",
            "contents": [
                { "type": "box", "layout": "horizontal", "contents": [
                    { "type": "text", "text": item.name, "wrap": true, "flex": 3, "weight": "bold" },
                    { "type": "text", "text": `x ${item.quantity}`, "flex": 1, "align": "end" }
                ]},
                { "type": "text", "text": details, "size": "xs", "color": "#aaaaaa", "wrap": true }
            ]
        };
    });

    const contents = [
        { "type": "text", "text": `受取: ${orderData.pickupTime}`, "size": "md", "weight": "bold", "margin": "md", "align": "center" },
        { "type": "separator", "margin": "md" },
        ...itemDetails,
        { "type": "separator", "margin": "lg" },
        { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "合計金額", "weight": "bold", "size": "lg" },
            { "type": "text", "text": `¥${orderData.totalPrice}`, "weight": "bold", "align": "end", "size": "lg", "color": "#E64A19" }
        ], "margin": "md"}
    ];

    if (orderData.notes) {
        contents.splice(2, 0, { // リストの適当な位置に挿入
             "type": "text", "text": `備考: ${orderData.notes}`, "size": "sm", "color": "#ff5722", "wrap": true, "margin": "md" 
        });
    }

    return { "type": "flex", "altText": "ご注文内容の確認", "contents": { "type": "bubble",
            "header": { "type": "box", "layout": "vertical", "contents": [
                { "type": "text", "text": "粉もんスタンド おしん", "weight": "bold", "color": "#E64A19", "size": "sm" },
                { "type": "text", "text": "ご注文ありがとうございます", "weight": "bold", "size": "lg", "margin": "md" }
            ]},
            "body": { "type": "box", "layout": "vertical", "contents": contents },
            "styles": { "header": { "backgroundColor": "#FFEBEE" }}
    }};
}

function showError(message) {
    console.error(message);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.innerHTML = `<p style="color: red; padding:1rem; text-align:center;">${message}</p>`;
    }
}

function showCustomAlert(title, message, onOkCallback) {
    dom.customAlertTitle.textContent = title;
    dom.customAlertMessage.textContent = message;
    dom.customAlertModal.classList.add('visible');
    const newOkButton = dom.customAlertOkButton.cloneNode(true);
    dom.customAlertOkButton.parentNode.replaceChild(newOkButton, dom.customAlertOkButton);
    dom.customAlertOkButton = newOkButton;
    dom.customAlertOkButton.onclick = () => {
        dom.customAlertModal.classList.remove('visible');
        if (typeof onOkCallback === 'function') onOkCallback();
    };
}
