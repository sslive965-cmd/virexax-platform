const $ = (id) => document.getElementById(id);
let authMode = 'login';
let currentUser = null;
let catalog = [];
let selectedNetwork = 'Mastercard';
let selectedProduct = null;
let adminProducts = [];
let adminOrders = [];

function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); $(id)?.classList.add('active'); window.scrollTo(0,0); }
function toast(msg){ const t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }
window.showToast=toast;
async function api(url, options={}){
  const headers = {...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}),...(options.headers||{})};
  const res=await fetch(url,{credentials:'include',headers,...options});
  let data={}; try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(paise){return `₹${(Number(paise||0)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function cleanDisplay(v){return String(v??'').replace(/\bdemo\b/gi,'').replace(/\bsimulated\b/gi,'').replace(/\s{2,}/g,' ').replace(/\s+([.,])/g,'$1').trim();}
function formatCardNumber(v){const s=String(v||'').replace(/\s+/g,''); const digits=s.replace(/\D/g,''); const last4=digits.slice(-4)||'2103'; return `•••• •••• •••• ${last4}`;}

function enterPlatform(){ show('auth'); $('authEmail')?.focus(); }
function toggleAuth(){ authMode=authMode==='signup'?'login':'signup'; $('authTitle').textContent=authMode==='signup'?'Create your account':'Welcome back'; $('authSub').textContent=authMode==='signup'?'Create an account to access the marketplace.':'Sign in to continue to the marketplace.'; $('authAction').textContent=authMode==='signup'?'Create Account':'Login'; $('authSwitch').innerHTML=authMode==='signup'?'Already have an account? <button onclick="toggleAuth()">Login</button>':'New here? <button onclick="toggleAuth()">Create account</button>'; }

async function customerAuth(){
  try{
    const email=$('authEmail').value.trim(), password=$('authPassword').value;
    const data=await api(authMode==='signup'?'/api/auth/signup':'/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
    currentUser=data.user;
    await openCustomer();
  }catch(e){toast(e.message)}
}
async function adminLogin(){try{const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:$('adminEmail').value.trim(),password:$('adminPassword').value})});if(data.user.role!=='admin')throw new Error('This account is not an administrator.');currentUser=data.user;await openAdmin();}catch(e){toast(e.message)}}
async function logout(){try{await api('/api/auth/logout',{method:'POST'})}catch{}currentUser=null;show('landing');}

async function boot(){try{const data=await api('/api/auth/me');currentUser=data.user;await openCustomer();}catch{show('landing');}}
async function openCustomer(){show('app');$('profileName').textContent=currentUser.name||currentUser.email;$('avatar').textContent=(currentUser.name||currentUser.email)[0].toUpperCase();const adminBtn=$('adminNavBtn');if(adminBtn)adminBtn.style.display=currentUser.role==='admin'?'inline-flex':'none';await loadCatalog();}
async function loadCatalog(){try{const data=await api('/api/products');catalog=data.products||[];renderCatalog();}catch(e){toast(e.message)}}
function setNetwork(network){selectedNetwork=network;document.querySelectorAll('.network-tab').forEach(b=>b.classList.toggle('active',b.dataset.network===network));renderCatalog();}
function renderCatalog(){
  const grid=$('catalogGrid');
  const counts={Mastercard:0,Visa:0,RuPay:0,'American Express':0};
  catalog.forEach(p=>{const n=p.brand||'Mastercard'; if(counts[n]!==undefined && Number(p.stock||0)>0) counts[n]+=1;});
  document.querySelectorAll('.network-tab').forEach(b=>{const n=b.dataset.network; const em=b.querySelector('em'); if(em) em.textContent=counts[n]||0;});
  const products=catalog.filter(p=>(p.brand||'Mastercard').toLowerCase()===selectedNetwork.toLowerCase());
  if(!products.length){grid.innerHTML=`<div class="empty neon-empty">No ${esc(selectedNetwork)} cards are available right now.</div>`;return;}
  grid.innerHTML=products.map(p=>productCard(p)).join('');
  $('marketCount').textContent=`${products.length} available`;
}
function productCard(p){
  const num=formatCardNumber(p.card_number);
  return `<article class="premium-product">
    <div class="availability"><span>AVAILABLE</span><span>${p.stock>0?'IN STOCK':'SOLD OUT'}</span></div>
    <div class="card-stage">
      <div class="flip-card" id="card-${esc(p.id)}" onclick="flipCard('${esc(p.id)}')" role="button" tabindex="0" aria-label="Flip card">
        <div class="flip-inner">
          <div class="card-face card-front">
            <button class="flip-btn" onclick="flipCard('${esc(p.id)}');event.stopPropagation()">↻ TAP TO FLIP</button>
            <div class="chip"></div><div class="network">${esc(p.brand||selectedNetwork)}</div>
            <div class="card-num">${esc(num)}</div>
            <div class="card-meta"><div><small>CARD HOLDER</small><b>${esc(cleanDisplay(p.card_holder||'CARD HOLDER'))}</b></div><div><small>CARD BALANCE</small><b>${money(p.card_balance_paise)}</b></div></div>
            <div class="brand-mark">${esc(p.brand||selectedNetwork)}</div>
          </div>
          <div class="card-face card-back">
            <button class="flip-btn" onclick="flipCard('${esc(p.id)}');event.stopPropagation()">↻ TAP TO FLIP BACK</button>
            <div class="magstripe"></div><div class="cvv-title">CVV</div><div class="cvv-box">•••</div><span class="hidden-note">🔒 Hidden until delivery</span><div class="brand-mark">${esc(p.brand||selectedNetwork)}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="detail-row"><span>Limit</span><b>${money(p.card_limit_paise)}</b></div>
    <div class="detail-row"><span>Expiry</span><b>${esc(p.expiry||'--/----')}</b></div>
    <div class="detail-row"><span>Delivery</span><b>${esc(p.delivery||'10 Mins')}</b></div>
    <div class="entry-line"><div><small>ENTRY FEE</small><strong>${money(p.price_paise)}</strong></div><span>Qty: ${p.stock}</span></div>
    <h3>${esc(cleanDisplay(p.name))}</h3><p>${esc(cleanDisplay(p.description||'Premium card'))}</p>
    <button class="buy-btn" ${p.stock<1?'disabled':''} onclick="buyNow('${esc(p.id)}')">🛒 &nbsp; BUY NOW</button>
  </article>`;
}
function flipCard(id){document.getElementById(`card-${id}`)?.classList.toggle('flipped');}
document.addEventListener('keydown',e=>{const el=document.activeElement;if(e.key==='Enter'&&el?.classList?.contains('flip-card'))el.click()});
function buyNow(id){const p=catalog.find(x=>x.id===id);if(!p||p.stock<1)return toast('This card is unavailable.');selectedProduct=p;showPayment();}
function showPayment(){if(!selectedProduct)return;show('payment');$('paymentProductName').textContent=selectedProduct.name;$('paymentAmount').textContent=money(selectedProduct.price_paise);$('paymentEntry').textContent=money(selectedProduct.price_paise);$('paymentRef').value='';window.scrollTo(0,0);}
function backToMarket(){show('app');setTimeout(()=>document.getElementById('market')?.scrollIntoView({behavior:'smooth'}),40);}
async function submitPayment(){
  if(!selectedProduct)return;
  const ref=$('paymentRef').value.trim();
  if(ref.length<3)return toast('Enter your payment reference / UTR.');
  try{
    await api('/api/orders',{method:'POST',body:JSON.stringify({productId:selectedProduct.id,paymentReference:ref})});
    $('paymentState').innerHTML='<div class="success-icon">✓</div><h2>Payment Request Submitted</h2><p>Your order has been submitted for verification.</p><button class="buy-btn" onclick="openOrders()">VIEW ORDER</button>';
    selectedProduct=null; await loadCatalog();
  }catch(e){toast(e.message)}
}
function openOrders(){
  if(!currentUser)return;
  api('/api/orders').then(data=>{const rows=(data.orders||[]).map(o=>`<div class="order-row"><div><b>${esc(o.id)}</b><span>${esc(o.product)}</span></div><div><strong>${money(o.amount_paise)}</strong><em class="status ${esc(o.status)}">${esc(o.status)}</em></div></div>`).join('');modal(`<h2>My Orders</h2>${rows||'<div class="empty">No orders yet.</div>'}`)}).catch(e=>toast(e.message));
}
function openTrack(){openOrders();}
function openSupport(){modal('<div class="support-modal"><h2>VIREXA Support</h2><p>For account and order help, contact VIREXA support on Telegram.</p><button class="gradient-btn support-btn" onclick="window.open(\'https://t.me/x4zbtgBRPMs0ZTk9\',\'_blank\')">✈ Open Telegram Support</button></div>');}
async function openProfile(){
  if(!currentUser)return;
  try{
    const data=await api('/api/orders');
    const orders=data.orders||[];
    const purchased=orders.length;
    const issued=orders.filter(o=>o.status==='approved').length;
    modal(`<div class="profile-card"><button class="xbtn" onclick="closeModal()">×</button><div class="profile-head"><div class="profile-avatar">${esc((currentUser.name||currentUser.email||'C')[0].toUpperCase())}</div><div><h2>${esc(currentUser.name||'Customer')}</h2><p>${esc(currentUser.email||'')}</p><span class="vip-badge">♛ VIP MEMBER</span></div></div><div class="profile-stats"><div><span>Account ID</span><b>${esc(currentUser.id||'—')}</b></div><div><span>Account Status</span><b class="verified">● Active</b></div><div><span>Purchased Virtual Cards</span><b>${purchased}</b></div><div><span>Issued Cards</span><b>${issued}</b></div></div><div class="profile-actions"><button class="secondary" onclick="closeModal();openOrders()">▤ My Orders</button><button class="danger-btn" onclick="logout();closeModal()">↪ Log Out</button></div></div>`);
  }catch(e){toast(e.message)}
}
function home(){show('app');}

async function openAdmin(){show('admin');await refreshAdmin();}
async function refreshAdmin(){try{const [stats,customers,orders,products]=await Promise.all([api('/api/admin/stats'),api('/api/admin/customers'),api('/api/orders'),api('/api/admin/products')]);$('adminCustomerCount').textContent=stats.customers;$('adminOrderCount').textContent=stats.orders;$('adminPendingCount').textContent=stats.pending;$('adminApprovedCount').textContent=stats.approved;adminOrders=orders.orders||[];adminProducts=products.products||[];renderCustomers(customers.customers||[]);renderAdminOrders();renderProducts();}catch(e){toast(e.message)}}
function renderCustomers(list){$('customerTable').innerHTML=list.map(c=>`<div class="admin-row"><div><b>${esc(c.email)}</b><small>${esc(c.name)} · joined ${new Date(c.created_at).toLocaleDateString()}</small></div><strong>${c.order_count} orders</strong></div>`).join('')||'<div class="empty">No customers.</div>';}
function renderAdminOrders(){const q=($('orderSearch').value||'').toLowerCase();const list=adminOrders.filter(o=>[o.id,o.customer_email,o.payment_reference,o.product,o.status].some(v=>String(v||'').toLowerCase().includes(q)));$('adminOrders').innerHTML=list.map(o=>`<div class="admin-row"><div><b>${esc(o.id)}</b><small>${esc(o.customer_email)} · ${esc(o.product)} · ${money(o.amount_paise)} · Ref: ${esc(o.payment_reference)}</small></div><select onchange="setOrderStatus('${esc(o.id)}',this.value)"><option value="pending" ${o.status==='pending'?'selected':''}>Pending</option><option value="approved" ${o.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${o.status==='rejected'?'selected':''}>Rejected</option></select></div>`).join('')||'<div class="empty">No matching orders.</div>';}
function renderProducts(){$('productTable').innerHTML=adminProducts.map(p=>`<div class="admin-row"><div><b>${esc(cleanDisplay(p.name))}</b><small>${esc(p.brand||'Mastercard')} · Entry Fee ${money(p.price_paise)} · stock ${p.stock} · ${p.active?'Active':'Inactive'}</small></div><div><button class="secondary" onclick="editProduct('${esc(p.id)}')">Edit</button><button class="secondary" onclick="toggleProduct('${esc(p.id)}',${p.active?0:1})">${p.active?'Disable':'Enable'}</button><button class="danger-btn small-delete" onclick="deleteProduct('${esc(p.id)}')">Delete</button></div></div>`).join('')||'<div class="empty">No products.</div>';}
async function setOrderStatus(id,status){try{await api('/api/admin/orders/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({status})});toast('Order status updated.');await refreshAdmin()}catch(e){toast(e.message)}}
async function saveProduct(){
  const id=$('productId').value.trim();
  const payload={name:$('productName').value.trim(),description:$('productDescription').value.trim(),pricePaise:Math.round(Number($('productPrice').value)*100),stock:Math.max(0,Math.floor(Number($('productStock').value))),brand:$('productBrand').value,cardNumber:$('productCardNumber').value.trim(),cardHolder:$('productCardHolder').value.trim(),cardBalancePaise:Math.round(Number($('productBalance').value)*100),cardLimitPaise:Math.round(Number($('productLimit').value)*100),expiry:$('productExpiry').value.trim(),delivery:$('productDelivery').value.trim(),entryFeePaise:Math.round(Number($('productPrice').value)*100),active:$('productActive').checked};
  if(!payload.name||!Number.isFinite(payload.pricePaise))return toast('Enter valid product data.');
  try{await api(id?'/api/admin/products/'+encodeURIComponent(id):'/api/admin/products',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});closeModal();toast(id?'Product updated.':'Product created.');await refreshAdmin()}catch(e){toast(e.message)}
}
function newProduct(){modal(`<h2>New Card Product</h2>${productForm()}`)}
function editProduct(id){const p=adminProducts.find(x=>x.id===id);if(!p)return;modal(`<h2>Edit Card Product</h2>${productForm(p)}`)}
function productForm(p={}){return `<input id="productId" type="hidden" value="${esc(p.id||'')}">
<label>Product name<input id="productName" placeholder="Product name" value="${esc(p.name||'')}"></label>
<label>Description<textarea id="productDescription" placeholder="Description">${esc(p.description||'')}</textarea></label>
<div class="form-grid"><label>Network<select id="productBrand"><option ${p.brand==='Mastercard'?'selected':''}>Mastercard</option><option ${p.brand==='Visa'?'selected':''}>Visa</option><option ${p.brand==='RuPay'?'selected':''}>RuPay</option><option ${p.brand==='American Express'?'selected':''}>American Express</option></select></label><label>Entry Fee (INR)<input id="productPrice" type="number" min="0" step="0.01" value="${p.price_paise!=null?(p.price_paise/100).toFixed(2):''}"></label></div>
<div class="form-grid"><label>Stock / Qty<input id="productStock" type="number" min="0" step="1" value="${p.stock??0}"></label><label>Card Holder<input id="productCardHolder" placeholder="Card holder" value="${esc(p.card_holder||'')}"></label></div>
<div class="form-grid"><label>Card Number<input id="productCardNumber" placeholder="Fictional card identifier" value="${esc(p.card_number||'')}"></label><label>Card Balance (INR)<input id="productBalance" type="number" min="0" step="0.01" value="${p.card_balance_paise!=null?(p.card_balance_paise/100).toFixed(2):''}"></label></div>
<div class="form-grid"><label>Limit (INR)<input id="productLimit" type="number" min="0" step="0.01" value="${p.card_limit_paise!=null?(p.card_limit_paise/100).toFixed(2):''}"></label><label>Expiry<input id="productExpiry" placeholder="MM/YYYY" value="${esc(p.expiry||'')}"></label></div>
<label>Delivery<input id="productDelivery" placeholder="10 Mins" value="${esc(p.delivery||'10 Mins')}"></label>
<p class="form-note">Card details are for the site's simulated interface only. Never enter real card credentials.</p>
<label class="check"><input id="productActive" type="checkbox" ${p.active===undefined||p.active?'checked':''}> Available</label><button class="primary" onclick="saveProduct()">Save Product</button>`}
async function toggleProduct(id,active){try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({active:Boolean(active)})});await refreshAdmin()}catch(e){toast(e.message)}}
async function deleteProduct(id){if(!confirm('Delete this product?'))return;try{await api('/api/admin/products/'+encodeURIComponent(id),{method:'DELETE'});toast('Product deleted.');await refreshAdmin()}catch(e){toast(e.message)}}
function modal(html){const content=String(html||'');$('modalContent').innerHTML=(content.includes('class="xbtn"')?content:'<button class="xbtn modal-close" onclick="closeModal()" aria-label="Close">×</button>'+content);$('modal').classList.add('open')}
function closeModal(){$('modal').classList.remove('open');$('modalContent').innerHTML=''}
window.enterPlatform=enterPlatform;window.toggleAuth=toggleAuth;window.customerAuth=customerAuth;window.adminLogin=adminLogin;window.logout=logout;window.setNetwork=setNetwork;window.flipCard=flipCard;window.buyNow=buyNow;window.showPayment=showPayment;window.backToMarket=backToMarket;window.submitPayment=submitPayment;window.openOrders=openOrders;window.openTrack=openTrack;window.openSupport=openSupport;window.openProfile=openProfile;window.home=home;window.refreshAdmin=refreshAdmin;window.renderAdminOrders=renderAdminOrders;window.setOrderStatus=setOrderStatus;window.newProduct=newProduct;window.editProduct=editProduct;window.saveProduct=saveProduct;window.toggleProduct=toggleProduct;window.deleteProduct=deleteProduct;window.closeModal=closeModal;
boot();
