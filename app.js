/** * app.js */
const LIFF_ID = "2009023539-6ANIeNDa"; 
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 

// グローバル状態
let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 5 }; 
let currentModalItem = null;

// DOM要素キャッシュ
const dom = {}; 

// エラー時のフォールバックデータ
const FALLBACK_MENU_DATA = [{
    id: 'error', category: 'エラー', name: 'メニュー読込失敗',
    description: '通信エラーが発生しました。再読み込みしてください。',
    imageUrl: 'https://placehold.co/300x200/ccc/333?text=Error',
    options: [{ sku: 'err', name: 'ー', price: 0 }], toppings: []
}];

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  setupDOM(); 
  
  if(dom.loading) dom.loading.style.display = 'flex';

  try {
    if (LIFF_ID) {
        await liff.init({ liffId: LIFF_ID }).catch(e => console.warn('LIFF Init failed', e));
        
        // LINEアプリ内チェック
        if (!liff.isInClient()) {
             console.log("外部ブラウザで起動中");
        }

        // ログイン処理
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        } else {
            userProfile = await liff.getProfile().catch(()=>null);
        }
    }
    
    setupEventListeners();
    await fetchInitialData();

  } catch (err) { 
    console.error(err);
    showCustomAlert("初期化エラー", `アプリを開始できませんでした。\n${err.message}`); 
  } finally { 
    if(dom.loading) dom.loading.style.opacity = '0';
    setTimeout(() => { if(dom.loading) dom.loading.style.display = 'none'; }, 300);
  }
}

function setupDOM() {
    dom.loading = document.getElementById('loading');
    dom.menuContainer = document.getElementById('menu-container');
    dom.categoryNav = document.getElementById('category-nav');
    
    dom.viewCartButton = document.getElementById('view-cart-button');
    dom.cartItemCount = document.getElementById('cart-item-count');
    dom.cartTotalPrice = document.getElementById('cart-total-price');
    
    dom.cartModal = document.getElementById('cart-modal');
    dom.closeCartModal = document.getElementById('close-cart-modal');
    dom.submitOrderButton = document.getElementById('submit-order-button');
    dom.cartItemsContainer = document.getElementById('cart-items-container');
    dom.cartModalTotalPrice = document.getElementById('cart-modal-total-price');
    dom.recipientName = document.getElementById('recipient-name');
    dom.pickupTime = document.getElementById('pickup-time');
    dom.orderNotes = document.getElementById('order-notes');
    
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
}

function setupEventListeners() {
    if(dom.viewCartButton) dom.viewCartButton.addEventListener('click', openCartModal);
    if(dom.closeCartModal) dom.closeCartModal.addEventListener('click', closeCartModal);
    if(dom.cartModal) dom.cartModal.addEventListener('click', (e) => { if (e.target === dom.cartModal) closeCartModal(); });
    
    if(dom.closeItemDetailModal) dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    if(dom.itemDetailModal) dom.itemDetailModal.addEventListener('click', (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); });

    if(dom.submitOrderButton) dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);

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
            if (q < 50) { 
                dom.itemDetailQuantity.textContent = q + 1;
                calculateDetailTotal();
            }
        });
    }

    if(dom.addToCartButton) dom.addToCartButton.addEventListener('click', handleAddToCartClick);
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.menu && Array.isArray(data.menu)) {
            menuData = data.menu;
            if (data.settings) {
                storeSettings = { ...storeSettings, ...data.settings };
            }
            displayMenu();
        } else { 
            throw new Error('データ形式が不正です'); 
        }
    } catch (err) {
        console.error(err);
        menuData = FALLBACK_MENU_DATA;
        displayMenu();
        showCustomAlert("通信エラー", "メニュー情報を取得できませんでした。\n通信環境を確認してください。");
    }
}

function displayMenu() {
  dom.menuContainer.innerHTML = '';
  dom.categoryNav.innerHTML = '';

  if (!menuData || menuData.length === 0) {
      dom.menuContainer.innerHTML = '<p style="padding:1rem;">メニューがありません。</p>';
      return;
  }

  const validItems = menuData.filter(item => item && item.category);
  const categories = [...new Set(validItems.map(item => item.category))];
  
  categories.forEach((cat, idx) => {
      const a = document.createElement('a');
      a.href = `#cat-${cat}`;
      a.textContent = cat;
      a.onclick = (e) => {
          e.preventDefault();
          const target = document.getElementById(`cat-${cat}`);
          if (target) {
              const offset = 120; 
              const bodyRect = document.body.getBoundingClientRect().top;
              const elementRect = target.getBoundingClientRect().top;
              const elementPosition = elementRect - bodyRect;
              const offsetPosition = elementPosition - offset;
              window.scrollTo({ top: offsetPosition, behavior: "smooth" });
          }
          document.querySelectorAll('.category-nav a').forEach(el => el.classList.remove('active'));
          a.classList.add('active');
      };
      if(idx === 0) a.classList.add('active');
      dom.categoryNav.appendChild(a);
  });

  categories.forEach(category => {
      const header = document.createElement('div');
      header.className = 'category-title';
      header.id = `cat-${category}`;
      header.textContent = category;
      dom.menuContainer.appendChild(header);

      const items = validItems.filter(m => m.category === category);
      items.forEach(group => {
        const card = document.createElement('div');
        card.className = 'menu-item-card';
        
        let priceText = 'ー';
        if (group.options && group.options.length > 0) {
            const prices = group.options.map(o => o.price).filter(p => !isNaN(p));
            if (prices.length > 0) {
                const min = Math.min(...prices);
                priceText = `¥${min.toLocaleString()}~`;
            }
        }

        const imgUrl = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
        
        card.innerHTML = `
            <img src="${imgUrl}" alt="${group.name}" loading="lazy" onerror="this.src='https://placehold.co/300x200/eee/ccc?text=No+Image'">
            <div class="item-info">
                <p class="item-name">${group.name}</p>
                <p class="item-price">${priceText}</p>
            </div>
        `;
        card.addEventListener('click', () => showItemDetailModal(group));
        dom.menuContainer.appendChild(card);
      });
  });
}

// --- 詳細モーダル処理 ---

function showItemDetailModal(group) {
    currentModalItem = group;

    try {
        dom.itemDetailName.textContent = group.name;
        dom.itemDetailImg.src = group.imageUrl || 'https://placehold.co/300x200/eee/ccc?text=No+Image';
        dom.itemDetailDescription.textContent = group.description || '';
        dom.itemDetailQuantity.textContent = '1';

        if (typeof group.flavors === 'string') {
            group.flavors = group.flavors.replace(/、/g, ',').split(',').map(s => s.trim()).filter(s => s);
        }

        dom.itemDetailOptions.innerHTML = '';
        if (group.options && group.options.length > 0) {
            group.options.forEach((opt, index) => {
                const safeSku = opt.sku || `opt-${index}`;
                
                const label = document.createElement('div');
                label.className = 'option-label';
                if(index === 0) label.classList.add('selected');
                
                label.innerHTML = `
                    <div style="display:flex; flex-direction:column;">
                        <span class="option-name">${opt.name}</span>
                        <span class="option-price">¥${opt.price.toLocaleString()}</span>
                    </div>
                    <div class="option-check-mark"></div>
                    <input type="radio" name="price-option" value="${safeSku}" 
                           data-name="${opt.name}" data-price="${opt.price}" 
                           ${index === 0 ? 'checked' : ''}>
                `;
                
                label.addEventListener('click', (e) => {
                    e.preventDefault(); 
                    const input = label.querySelector('input');
                    input.checked = true;
                    
                    handleOptionChange(group, safeSku);
                    calculateDetailTotal();
                    updateSelectionStyles(dom.itemDetailOptions, 'radio');
                });

                dom.itemDetailOptions.appendChild(label);
            });
        } else {
            dom.itemDetailOptions.innerHTML = '<p style="color:red">オプション設定がありません</p>';
        }

        dom.itemDetailFlavors.innerHTML = '';
        if (group.flavors && Array.isArray(group.flavors) && group.flavors.length > 0) {
            dom.sectionFlavors.style.display = 'block';
            
            const initialSku = group.options && group.options[0] ? group.options[0].sku : '';
            const isLarge = String(initialSku).includes('16'); 
            
            renderFlavors(group, isLarge);
        } else {
            dom.sectionFlavors.style.display = 'none';
        }

        dom.itemDetailToppings.innerHTML = '';
        const toppings = group.toppings || [];
        const topSection = document.getElementById('section-toppings');
        
        if (toppings.length === 0) {
            if (topSection) topSection.style.display = 'none';
        } else {
            if (topSection) topSection.style.display = 'block';
            toppings.forEach((top, idx) => {
                const label = document.createElement('div');
                label.className = 'option-label';
                
                const priceText = top.price > 0 ? `+¥${top.price}` : '無料';
                
                label.innerHTML = `
                    <div>
                        <span>${top.name}</span>
                        <span style="color:#E64A19; font-weight:bold; margin-left:8px;">${priceText}</span>
                    </div>
                    <div class="option-check-mark"></div>
                    <input type="checkbox" name="topping-option" value="${top.id}" data-name="${top.name}" data-price="${top.price}">
                `;

                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    const input = label.querySelector('input');
                    input.checked = !input.checked;
                    
                    calculateDetailTotal();
                    updateSelectionStyles(dom.itemDetailToppings, 'checkbox');
                });

                dom.itemDetailToppings.appendChild(label);
            });
        }

        calculateDetailTotal();
        dom.itemDetailModal.classList.add('visible');
    } catch (e) {
        console.error(e);
        showCustomAlert('エラー', '商品詳細の表示に失敗しました。\n' + e.message);
    }
}

function renderFlavors(group, isMultiSelect) {
    dom.itemDetailFlavors.innerHTML = '';
    
    if (isMultiSelect) {
        dom.flavorNote.textContent = '※2種類まで選択可能です（ハーフ＆ハーフ）';
    } else {
        dom.flavorNote.textContent = '※味を1つ選んでください';
    }

    group.flavors.forEach((flavor, idx) => {
        if(!flavor) return;
        const label = document.createElement('div');
        label.className = 'option-label';
        
        const type = isMultiSelect ? 'checkbox' : 'radio';
        const name = isMultiSelect ? 'flavor-option-check' : 'flavor-option-radio';
        
        label.innerHTML = `
            <span>${flavor}</span>
            <div class="option-check-mark"></div>
            <input type="${type}" name="${name}" value="${flavor}">
        `;
        
        label.addEventListener('click', (e) => {
            e.preventDefault();
            const input = label.querySelector('input');
            
            if (type === 'radio') {
                input.checked = true;
                const radios = dom.itemDetailFlavors.querySelectorAll(`input[name="${name}"]`);
                radios.forEach(r => { if(r !== input) r.checked = false; });
            } else {
                input.checked = !input.checked;
                const checkedCount = dom.itemDetailFlavors.querySelectorAll('input:checked').length;
                if (checkedCount > 2) {
                    input.checked = false;
                    showCustomAlert('選択制限', 'ハーフ＆ハーフは2種類までです。');
                }
            }
            
            calculateDetailTotal();
            updateSelectionStyles(dom.itemDetailFlavors, type);
        });
        
        dom.itemDetailFlavors.appendChild(label);
    });
}

function handleOptionChange(group, sku) {
    if (!group.flavors || group.flavors.length === 0) return;

    const skuStr = String(sku);
    const isLargePortion = skuStr.includes('16'); 
    renderFlavors(group, isLargePortion);
}

function updateSelectionStyles(container, type) {
    container.querySelectorAll('.option-label').forEach(label => {
        const input = label.querySelector('input');
        if (input && input.checked) {
            label.classList.add('selected');
        } else {
            label.classList.remove('selected');
        }
    });
}

function calculateDetailTotal() {
    const optInput = dom.itemDetailOptions.querySelector('input:checked');
    const basePrice = optInput ? parseInt(optInput.dataset.price, 10) : 0;
    
    let toppingPrice = 0;
    dom.itemDetailToppings.querySelectorAll('input:checked').forEach(el => {
        toppingPrice += parseInt(el.dataset.price, 10);
    });
    
    const qty = parseInt(dom.itemDetailQuantity.textContent, 10);
    dom.itemDetailTotalPreview.textContent = ((basePrice + toppingPrice) * qty).toLocaleString();
}

// --- カート処理 ---

function handleAddToCartClick() {
    if (!currentModalItem) return;

    const opt = dom.itemDetailOptions.querySelector('input:checked');
    if (!opt) { showCustomAlert('未選択', 'サイズまたは個数を選択してください'); return; }

    let flavors = [];
    const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input');
    if (flavorInputs.length > 0) {
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length === 0) { showCustomAlert('未選択', '味（フレーバー）を選択してください'); return; }
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
        option: opt.dataset.name, // ★追加: バックエンド連携用
        basePrice: parseInt(opt.dataset.price, 10),
        flavors: flavors,
        toppings: toppings,
        quantity: qty
    };

    addToCart(newItem);
    closeItemDetailModal();
    
    dom.viewCartButton.classList.add('bump');
    setTimeout(()=>dom.viewCartButton.classList.remove('bump'), 200);
}

function addToCart(newItem) {
    const genKey = (item) => {
        const fStr = (Array.isArray(item.flavors) ? item.flavors.sort() : []).join('|');
        const tStr = item.toppings.map(t=>t.id).sort().join('|');
        return `${item.groupId}_${item.sku}_${fStr}_${tStr}`;
    };

    const newKey = genKey(newItem);
    const existingIndex = cart.findIndex(item => genKey(item) === newKey);

    const tPrice = newItem.toppings.reduce((s,t) => s + t.price, 0);
    newItem.unitPrice = newItem.basePrice + tPrice;

    if (existingIndex > -1) {
        cart[existingIndex].quantity += newItem.quantity;
    } else {
        cart.push(newItem);
    }
    updateCartView();
}

function updateCartView() {
    const count = cart.reduce((s,i) => s + i.quantity, 0);
    const total = cart.reduce((s,i) => s + (i.unitPrice * i.quantity), 0);
    
    dom.cartItemCount.textContent = count;
    dom.cartTotalPrice.textContent = total.toLocaleString();
    
    if (count > 0) {
        dom.viewCartButton.disabled = false;
        dom.viewCartButton.style.opacity = '1';
    } else {
        dom.viewCartButton.disabled = true;
    }
}

function openCartModal() {
    renderCartItems();
    updatePickupTimeOptions();
    
    const total = cart.reduce((s,i) => s + (i.unitPrice * i.quantity), 0);
    dom.cartModalTotalPrice.textContent = total.toLocaleString();

    dom.cartModal.classList.add('visible');
}

function closeCartModal() { 
    dom.cartModal.classList.remove('visible'); 
}

function closeItemDetailModal() {
    dom.itemDetailModal.classList.remove('visible');
    currentModalItem = null;
}

function renderCartItems() {
    dom.cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        dom.cartItemsContainer.innerHTML = '<div class="cart-empty-msg">カートは空です 🛒<br>商品を選んでください</div>';
        dom.submitOrderButton.disabled = true;
        return;
    }
    dom.submitOrderButton.disabled = false;

    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        
        let flavorStr = '';
        if (item.flavors && item.flavors.length > 0) {
            flavorStr = item.flavors.join(' / ');
        }
        
        let toppingStr = '';
        if (item.toppings && item.toppings.length > 0) {
            toppingStr = '+' + item.toppings.map(t=>t.name).join(', ');
        }

        div.innerHTML = `
            <div class="cart-item-header">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-total">¥${(item.unitPrice * item.quantity).toLocaleString()}</div>
            </div>
            
            <div class="cart-item-details">
                <div class="cart-detail-line">
                    <span class="cart-detail-label">サイズ:</span>
                    <span>${item.optionName}</span>
                </div>
                ${flavorStr ? `
                <div class="cart-detail-line">
                    <span class="cart-detail-label">味:</span>
                    <span>${flavorStr}</span>
                </div>` : ''}
                ${toppingStr ? `
                <div class="cart-detail-line">
                    <span class="cart-detail-label">追加:</span>
                    <span style="color:#E64A19;">${toppingStr}</span>
                </div>` : ''}
            </div>

            <div class="cart-item-actions">
                <div style="font-weight:bold;">数量: ${item.quantity}個</div>
                <button class="remove-btn" onclick="removeItem(${index})">削除</button>
            </div>
        `;
        dom.cartItemsContainer.appendChild(div);
    });
}

window.removeItem = (index) => {
    if(confirm('この商品をカートから削除しますか？')) {
        cart.splice(index, 1);
        updateCartView();
        renderCartItems();
        
        const total = cart.reduce((s,i) => s + (i.unitPrice * i.quantity), 0);
        dom.cartModalTotalPrice.textContent = total.toLocaleString();
        
        if(cart.length === 0) closeCartModal();
    }
};

function updatePickupTimeOptions() {
    const select = dom.pickupTime;
    if (!select) return;
    select.innerHTML = '';
    
    const opt = document.createElement('option');
    opt.value = 'shortest'; opt.textContent = '最短で受け取る（準備でき次第）';
    select.appendChild(opt);

    const now = new Date();
    
    const interval = parseInt(storeSettings.interval) || 5; 
    const prep = parseInt(storeSettings.prep) || 30;

    const extractTime = (str) => {
        if (!str) return null;
        const match = String(str).match(/(\d{1,2}):(\d{2})/);
        if (match) return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) };
        return null;
    };
    
    const openTime = extractTime(storeSettings.open) || { h: 11, m: 0 };
    const closeTime = extractTime(storeSettings.close) || { h: 21, m: 0 };

    const openDate = new Date(now); openDate.setHours(openTime.h, openTime.m, 0, 0);
    const closeDate = new Date(now); closeDate.setHours(closeTime.h, closeTime.m, 0, 0);
    
    let earliest = new Date(now.getTime() + prep * 60000);
    
    let t = (earliest > openDate) ? earliest : openDate;
    
    let m = t.getMinutes();
    let rem = m % interval;
    if(rem !== 0) t.setMinutes(m + (interval - rem));
    t.setSeconds(0); t.setMilliseconds(0);

    while (t <= closeDate) {
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');
        const val = `${hh}:${mm}`;
        
        if (t > now) {
            const o = document.createElement('option');
            o.value = val; o.textContent = `${val} 頃`;
            select.appendChild(o);
        }
        
        t.setMinutes(t.getMinutes() + interval);
    }
}

async function confirmAndSubmitOrder() {
    dom.submitOrderButton.disabled = true;
    const originalText = dom.submitOrderButton.textContent;
    dom.submitOrderButton.textContent = '送信中...';
    
    const recipientName = dom.recipientName.value.trim();
    if (!recipientName) {
        showCustomAlert('入力エラー', '受取人のお名前を入力してください');
        dom.submitOrderButton.disabled = false;
        dom.submitOrderButton.textContent = originalText;
        return;
    }
    
    let pickupTime = dom.pickupTime.options[dom.pickupTime.selectedIndex].text;
    if (dom.pickupTime.value === 'shortest') pickupTime = '最短（準備でき次第）';
    
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
        
        // ★修正: 送信処理を呼び出す
        await sendThanksMessage(orderData);
        
        showCustomAlert('注文完了', 'ご注文ありがとうございます！\nLINEの通知をご確認ください。', () => {
            if(liff.isInClient()) liff.closeWindow();
            else location.reload();
        });
        
        cart = [];
        updateCartView();
        closeCartModal();

    } catch(e) {
        showCustomAlert('送信エラー', '注文の送信に失敗しました。\n店員に直接お伝えください。\n' + e.message);
        dom.submitOrderButton.disabled = false;
        dom.submitOrderButton.textContent = originalText;
    }
}

// ★修正: Flex Message送信 ＆ テキストフォールバック
async function sendThanksMessage(orderData) {
  if (!liff.isInClient()) return;
  
  try {
    const flexMessage = createReceiptFlexMessage(orderData);
    await liff.sendMessages([flexMessage]);
  } catch (err) {
    console.error('Flex Message Error:', err);
    // ★追加: Flexが失敗したらテキストで再送
    try {
        const safePrice = Number(orderData.totalPrice).toLocaleString();
        const textMsg = `【注文完了】\n粉もんスタンド おしん\n\nご注文ありがとうございます。\n\n受取人: ${orderData.recipientName}\n金額: ¥${safePrice}\n\n※詳細は注文履歴をご確認ください。`;
        await liff.sendMessages([{ type: 'text', text: textMsg }]);
    } catch(e2) {
        console.error('Fallback Error:', e2);
        showCustomAlert('通知エラー', '通知の送信に失敗しましたが、注文は完了しています。');
    }
  }
}

function createReceiptFlexMessage(orderData) {
    const safeTotalPrice = Number(orderData.totalPrice).toLocaleString();
    const safeRecipient = String(orderData.recipientName || 'お客様');
    const safeTime = String(orderData.pickupTime || 'ー');

    const itemDetails = orderData.cart.map(item => {
        let desc = item.optionName ? String(item.optionName) : '';
        if(item.flavors && item.flavors.length) desc += ` / ${item.flavors.join(',')}`;
        if(item.toppings && item.toppings.length) desc += ` / +${item.toppings.map(t=>t.name).join(',')}`;
        if (!desc) desc = ' '; 

        return {
            "type": "box", "layout": "horizontal",
            "contents": [
                { "type": "text", "text": `${item.name}`, "wrap": true, "flex": 3, "weight": "bold" },
                { "type": "text", "text": `x ${item.quantity}`, "flex": 1, "align": "end" }
            ]
        };
    });

    const bodyContents = [
        { "type": "text", "text": "ご注文内容", "size": "xs", "color": "#aaaaaa" },
        { "type": "separator", "margin": "md" },
        ...itemDetails,
        { "type": "separator", "margin": "lg" },
        { "type": "box", "layout": "vertical", "margin": "md", "contents": [
             { "type": "text", "text": "受取情報", "size": "xs", "color": "#aaaaaa" },
             { "type": "text", "text": `受取人: ${safeRecipient} 様`, "size": "sm", "margin": "sm" },
             { "type": "text", "text": `時間: ${safeTime}`, "size": "sm", "margin": "sm", "weight": "bold", "color": "#E64A19" }
        ]},
        { "type": "separator", "margin": "lg" },
        { "type": "box", "layout": "horizontal", "contents": [
            { "type": "text", "text": "合計金額", "weight": "bold" },
            { "type": "text", "text": `¥${safeTotalPrice}`, "weight": "bold", "align": "end" }
        ], "margin": "md"}
    ];

    // ★修正: 備考欄の安全な処理
    if (orderData.notes && typeof orderData.notes === 'string' && orderData.notes.trim() !== '') {
        const noteText = orderData.notes.substring(0, 300); // 文字数制限
        bodyContents.push({ "type": "separator", "margin": "md" });
        bodyContents.push({ "type": "text", "text": `備考: ${noteText}`, "size": "xs", "color": "#555", "wrap": true, "margin": "md" });
    }

    return { "type": "flex", "altText": "ご注文ありがとうございます", "contents": { "type": "bubble",
            "header": { "type": "box", "layout": "vertical", "contents": [
                { "type": "text", "text": "粉もんスタンド おしん", "weight": "bold", "color": "#ffffff" },
                { "type": "text", "text": "ご注文承りました", "weight": "bold", "size": "xl", "color": "#ffffff", "margin": "md" }
            ]},
            "body": { "type": "box", "layout": "vertical", "contents": bodyContents },
            "styles": { "header": { "backgroundColor": "#1e50a2" }}
    }};
}

function showCustomAlert(title, msg, cb) {
    dom.customAlertTitle.textContent = title;
    dom.customAlertMessage.textContent = msg;
    dom.customAlertModal.classList.add('visible');
    dom.customAlertOkButton.onclick = () => { 
        dom.customAlertModal.classList.remove('visible'); 
        if(cb) cb(); 
    };
}
