/** * app.js */
const LIFF_ID = "2009023539-6ANIeNDa"; 
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbw6Mk45Q_WaJvgG5NR9oCuPpNwKOMERL7uun0OmB4tAew9NWqpokpwgwF9XNRbYdoPBHA/exec"; 

// グローバル状態
let menuData = [];
let cart = [];
let userProfile = null;
let storeSettings = { open: "11:00", close: "21:00", prep: 30, interval: 5 }; // 初期設定を5分刻みに変更
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
  
  // ローディング表示
  if(dom.loading) dom.loading.style.display = 'flex';

  try {
    // LIFF初期化（IDが設定されている場合のみ）
    if (LIFF_ID) {
        await liff.init({ liffId: LIFF_ID }).catch(e => console.warn('LIFF Init failed', e));
        if (liff.isLoggedIn()) {
            userProfile = await liff.getProfile().catch(()=>null);
        } else {
            // 自動ログインさせたい場合はここで liff.login();
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
    // Main
    dom.loading = document.getElementById('loading');
    dom.menuContainer = document.getElementById('menu-container');
    dom.categoryNav = document.getElementById('category-nav');
    
    // Footer Cart
    dom.viewCartButton = document.getElementById('view-cart-button');
    dom.cartItemCount = document.getElementById('cart-item-count');
    dom.cartTotalPrice = document.getElementById('cart-total-price');
    
    // Cart Modal
    dom.cartModal = document.getElementById('cart-modal');
    dom.closeCartModal = document.getElementById('close-cart-modal');
    dom.submitOrderButton = document.getElementById('submit-order-button');
    dom.cartItemsContainer = document.getElementById('cart-items-container');
    dom.cartModalTotalPrice = document.getElementById('cart-modal-total-price');
    dom.recipientName = document.getElementById('recipient-name');
    dom.pickupTime = document.getElementById('pickup-time');
    dom.orderNotes = document.getElementById('order-notes');
    
    // Item Detail Modal
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
    
    // Alert
    dom.customAlertModal = document.getElementById('custom-alert-modal');
    dom.customAlertTitle = document.getElementById('custom-alert-title');
    dom.customAlertMessage = document.getElementById('custom-alert-message');
    dom.customAlertOkButton = document.getElementById('custom-alert-ok-button');
}

function setupEventListeners() {
    // Modal Toggles
    if(dom.viewCartButton) dom.viewCartButton.addEventListener('click', openCartModal);
    if(dom.closeCartModal) dom.closeCartModal.addEventListener('click', closeCartModal);
    if(dom.cartModal) dom.cartModal.addEventListener('click', (e) => { if (e.target === dom.cartModal) closeCartModal(); });
    
    if(dom.closeItemDetailModal) dom.closeItemDetailModal.addEventListener('click', closeItemDetailModal);
    if(dom.itemDetailModal) dom.itemDetailModal.addEventListener('click', (e) => { if (e.target === dom.itemDetailModal) closeItemDetailModal(); });

    // Order Submit
    if(dom.submitOrderButton) dom.submitOrderButton.addEventListener('click', confirmAndSubmitOrder);

    // Quantity Logic
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
            if (q < 50) { // Limit max
                dom.itemDetailQuantity.textContent = q + 1;
                calculateDetailTotal();
            }
        });
    }

    // Add to Cart
    if(dom.addToCartButton) dom.addToCartButton.addEventListener('click', handleAddToCartClick);
}

async function fetchInitialData() {
    try {
        const response = await fetch(BACKEND_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data.menu && Array.isArray(data.menu)) {
            menuData = data.menu;
            if (data.settings) storeSettings = { ...storeSettings, ...data.settings };
            displayMenu();
        } else { 
            throw new Error('データ形式が不正です'); 
        }
    } catch (err) {
        console.error(err);
        menuData = FALLBACK_MENU_DATA;
        displayMenu();
        // 初回のみアラートを出す
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

  // 有効なアイテムのみ
  const validItems = menuData.filter(item => item && item.category);
  // カテゴリ抽出
  const categories = [...new Set(validItems.map(item => item.category))];
  
  // ナビ生成
  categories.forEach((cat, idx) => {
      const a = document.createElement('a');
      a.href = `#cat-${cat}`;
      a.textContent = cat;
      a.onclick = (e) => {
          e.preventDefault();
          const target = document.getElementById(`cat-${cat}`);
          if (target) {
              // ヘッダー + ナビ分のオフセット
              const offset = 120; 
              const bodyRect = document.body.getBoundingClientRect().top;
              const elementRect = target.getBoundingClientRect().top;
              const elementPosition = elementRect - bodyRect;
              const offsetPosition = elementPosition - offset;
              window.scrollTo({ top: offsetPosition, behavior: "smooth" });
          }
          // Active styling
          document.querySelectorAll('.category-nav a').forEach(el => el.classList.remove('active'));
          a.classList.add('active');
      };
      if(idx === 0) a.classList.add('active');
      dom.categoryNav.appendChild(a);
  });

  // 商品リスト生成
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
        
        // 価格表示ロジック
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
        // イベントリスナー
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

        // ★安全策: バックエンドからのデータがまだ文字列のままの場合、ここで配列に直す
        if (typeof group.flavors === 'string') {
            group.flavors = group.flavors.replace(/、/g, ',').split(',').map(s => s.trim()).filter(s => s);
        }

        // 1. オプション（サイズ・個数）生成
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

        // 2. フレーバー生成
        dom.itemDetailFlavors.innerHTML = '';
        if (group.flavors && Array.isArray(group.flavors) && group.flavors.length > 0) {
            dom.sectionFlavors.style.display = 'block';
            
            const initialSku = group.options && group.options[0] ? group.options[0].sku : '';
            const isLarge = String(initialSku).includes('16'); 
            
            renderFlavors(group, isLarge);
        } else {
            dom.sectionFlavors.style.display = 'none';
        }

        // 3. トッピング生成
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

// フレーバーのレンダリング（単一選択/複数選択 切り替え対応）
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
    // オプション価格
    const optInput = dom.itemDetailOptions.querySelector('input:checked');
    const basePrice = optInput ? parseInt(optInput.dataset.price, 10) : 0;
    
    // トッピング価格
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

    // 必須チェック
    const opt = dom.itemDetailOptions.querySelector('input:checked');
    if (!opt) { showCustomAlert('未選択', 'サイズまたは個数を選択してください'); return; }

    // フレーバーチェック
    let flavors = [];
    const flavorInputs = dom.itemDetailFlavors.querySelectorAll('input');
    if (flavorInputs.length > 0) {
        const checked = dom.itemDetailFlavors.querySelectorAll('input:checked');
        if (checked.length === 0) { showCustomAlert('未選択', '味（フレーバー）を選択してください'); return; }
        checked.forEach(el => flavors.push(el.value));
    }

    // トッピング
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
    
    // フィードバック
    dom.viewCartButton.classList.add('bump');
    setTimeout(()=>dom.viewCartButton.classList.remove('bump'), 200);
}

function addToCart(newItem) {
    // 同一商品の判定キー
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
    
    // 合計金額更新
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
        
        // オプション文字列
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

// グローバル関数（HTML内のonclickから呼ぶため）
window.removeItem = (index) => {
    if(confirm('この商品をカートから削除しますか？')) {
        cart.splice(index, 1);
        updateCartView();
        renderCartItems();
        
        // 合計再計算
        const total = cart.reduce((s,i) => s + (i.unitPrice * i.quantity), 0);
        dom.cartModalTotalPrice.textContent = total.toLocaleString();
        
        if(cart.length === 0) closeCartModal();
    }
};

// 時間オプション
function updatePickupTimeOptions() {
    const select = dom.pickupTime;
    select.innerHTML = '';
    
    // 最短
    const opt = document.createElement('option');
    opt.value = 'shortest'; opt.textContent = '最短で受け取る（準備でき次第）';
    select.appendChild(opt);

    const now = new Date();
    // 5分刻み、30分後からに固定
    const interval = 5; 
    const prep = 30;

    // 時間パース
    const parseTime = (tStr) => {
        const [h, m] = tStr.split(':').map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        return d;
    };
    
    const openTime = parseTime(storeSettings.open);
    const closeTime = parseTime(storeSettings.close);
    
    // 最短受取可能時刻
    let earliest = new Date(now.getTime() + prep * 60000);
    
    // 開始時刻設定
    let t = new Date(earliest);
    if (t < openTime) t = new Date(openTime);
    
    // 分をinterval刻みに丸める
    let m = t.getMinutes();
    let rem = m % interval;
    if(rem !== 0) t.setMinutes(m + (interval - rem));
    t.setSeconds(0); t.setMilliseconds(0);

    while (t <= closeTime) {
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');
        const val = `${hh}:${mm}`;
        const o = document.createElement('option');
        o.value = val; o.textContent = `${val} 頃`;
        select.appendChild(o);
        t.setMinutes(t.getMinutes() + interval);
    }
}

// 注文送信
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
        // Google Apps Scriptへ送信
        await fetch(BACKEND_URL, {
            method: 'POST', mode: 'no-cors',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(orderData)
        });
        
        // LINEメッセージ送信
        await sendThanksMessage(orderData);
        
        showCustomAlert('注文完了', 'ご注文ありがとうございます！\nお店でお待ちしております。', () => {
            if(liff.isInClient()) liff.closeWindow();
            else location.reload();
        });
        
        // カートクリア
        cart = [];
        updateCartView();
        closeCartModal();

    } catch(e) {
        showCustomAlert('送信エラー', '注文の送信に失敗しました。\n店員に直接お伝えください。\n' + e.message);
        dom.submitOrderButton.disabled = false;
        dom.submitOrderButton.textContent = originalText;
    }
}

async function sendThanksMessage(orderData) {
  if (!liff.isInClient()) return;
  
  // Flex Message生成
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
      { "type": "text", "text": `時間: ${orderData.pickupTime}`, "weight": "bold", "align": "center", "size": "xl", "margin": "sm", "color": "#E64A19" },
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
            ], "backgroundColor": "#1e50a2" },
            "body": { "type": "box", "layout": "vertical", "contents": contents }
        }
    }]);
  } catch (e) { console.log('LINE Msg Error', e); }
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
