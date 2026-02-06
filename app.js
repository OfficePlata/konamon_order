document.addEventListener('DOMContentLoaded', initializeApp);

const LIFF_ID = "2009023539-6ANIeNDa"; 
// ★デプロイ後に発行された新しいURLに書き換えてください
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 

let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 15 };
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
    setupEventListeners();
    await fetchInitialData();
  } catch (err) { showError(`初期化エラー: ${err.message}`); } 
  finally { if(dom.loading) dom.loading.style.display = 'none'; }
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.message || 'Server Logic Error');

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
  if (!menuData || !Array.isArray(menuData) || menuData.length === 0) {
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
        // キャッシュバスターを追加して画像更新を即時反映
        const imgDisplayUrl = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;

        card.innerHTML = `
            <img src="${imgDisplayUrl}" alt="${group.name}" onerror="this.src='https://placehold.co/300x200/eee/ccc?text=No+Image'">
            <div class="item-info">
                <p class="item-name">${group.name}</p>
                <p class="item-price">${priceText}</p>
            </div>
        `;
        card.onclick = () => showItemDetailModal(group);
        dom.menuContainer.appendChild(card);
      });
  });
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
    const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
    dom.itemDetailImg.src = imgUrl.startsWith('http') ? `${imgUrl}?t=${new Date().getTime()}` : imgUrl;
    dom.itemDetailDescription.textContent = group.description || '';
    
    dom.itemDetailOptions.innerHTML = '';
    let isFirstOption = true;
    
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
        dom.itemDetailOptions.innerHTML = '<p style="color:#e64a19; font-weight:bold;">オプション情報がありません</p>';
        dom.addToCartButton.disabled = true;
    }

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
            dom.itemDetailFlavors.appendChild(label);
        });
        if(group.options && group.options.length > 0) {
            handleOptionChange(group, group.options[0].sku);
        }
    } else {
        dom.sectionFlavors.style.display = 'none';
    }

    dom.itemDetailToppings.innerHTML = '';
    const toppings = group.toppings || [];
    const section = document.getElementById('item-detail-toppings').closest('.option-section');
    
    if (toppings.length === 0) {
        if(section) section.style.display = 'none';
    } else {
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
    if(group.options && group.options.length > 0) dom.addToCartButton.disabled = false;

    // ボタンのイベントリスナー再設定
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
        if (group.flavors && group.flavors.length > 0 && group.flavors[0] !== "") {
            const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input:checked');
            if (flavorInputs.length === 0) {
                showCustomAlert('選択エラー', '味を選択してください。');
                return;
            }
            flavorInputs.forEach(input => selectedFlavors.push(input.value));
        }
        
        const selectedToppings = [];
        dom.itemDetailToppings.querySelectorAll('input[name="topping-option"]:checked').forEach(el => {
            selectedToppings.push({ id: el.value, name: el.dataset.name, price: parseInt(el.dataset.price, 10) });
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
        dom.flavorNote.textContent = '※2種類まで選択可能です。';
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
            for(let i=1; i<checked.length; i++) checked[i].checked = false;
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
    dom.itemDetailToppings.querySelectorAll('input[name="topping-option"]:checked').forEach(el => toppingPrice += parseInt(el.dataset.price, 10));

    const quantity = parseInt(dom.itemDetailQuantity.textContent, 10);
    const total = (basePrice + toppingPrice) * quantity;
    dom.itemDetailTotalPreview.textContent = total;
}

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
}

function addToCart(newItem) {
  // ★修正: 商品識別IDの生成を厳密化
  // トッピングIDのソート結合 (IDでソートして同一性を保証)
  const newItemToppingId = newItem.toppings.map(t => t.id).sort().join(',');
  // フレーバーのソート結合
  const newItemFlavors = Array.isArray(newItem.flavors) ? newItem.flavors.sort().join(',') : (newItem.flavors || '');

  // 既存アイテム検索
  const existingItemIndex = cart.findIndex(cartItem => {
      const cartItemToppingId = cartItem.toppings.map(t => t.id).sort().join(',');
      const cartItemFlavors = Array.isArray(cartItem.flavors) ? cartItem.flavors.sort().join(',') : (cartItem.flavors || '');
      
      // SKU、トッピング、フレーバーが全て一致する場合のみ同一商品とみなす
      return cartItem.sku === newItem.sku && 
             cartItemToppingId === newItemToppingId &&
             cartItemFlavors === newItemFlavors;
  });

  if (existingItemIndex > -1) {
    cart[existingItemIndex].quantity += newItem.quantity;
  } else {
    // カート内での単価計算（ベース＋トッピング）
    const unitPrice = newItem.basePrice + newItem.toppings.reduce((sum, t) => sum + t.price, 0);
    // 既存配列に追加する形にする
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
    const interval = parseInt(config.interval) || 5; // デフォルト5分
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
    
    // ★修正: フレーバーとトッピングを詳細に表示
    let metaText = item.optionName;
    if (item.flavors && (Array.isArray(item.flavors) ? item.flavors.length > 0 : item.flavors)) {
        const flavorStr = Array.isArray(item.flavors) ? item.flavors.join(' / ') : item.flavors;
        if(flavorStr) metaText += ` <span style="color:#e64a19;">[${flavorStr}]</span>`;
    }

    let toppingHtml = '';
    if (item.toppings && item.toppings.length > 0) {
        toppingHtml = `<div class="cart-item-toppings" style="font-size:0.85rem; color:#555; margin-top:4px;">
            + ${item.toppings.map(t => t.name).join('<br>+ ')}
        </div>`;
    }

    itemEl.innerHTML = `
        <div class="cart-item-details">
            <p class="cart-item-name">${item.name}</p>
            <p class="cart-item-meta">${metaText}</p>
            ${toppingHtml}
            <p class="cart-item-price">@¥${item.unitPrice} × ${item.quantity} = <strong>¥${item.unitPrice * item.quantity}</strong></p>
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
        flavors: item.flavors ? (Array.isArray(item.flavors) ? item.flavors.join(',') : item.flavors) : '',
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
    showCustomAlert('注文完了', 'お店からの返信をもって注文完了です！\nお店からの返信を必ずご確認ください！！', () => liff.closeWindow());

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
        closeCustomAlert();
        if (typeof onOkCallback === 'function') onOkCallback();
    };
}

function closeCustomAlert() {
    dom.customAlertModal.classList.remove('visible');
}
