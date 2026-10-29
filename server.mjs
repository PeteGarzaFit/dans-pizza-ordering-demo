import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, '.data');
const dataFile = path.join(dataDir, 'state.json');
const port = Number(process.env.PORT || 3000);
const taxRate = 0.0825;
const seed = {
  menu: JSON.parse(await readFile(path.join(root, 'menu-data.json'), 'utf8')),
  orders: [
    {id:'DP-1042',customer:'Maya Thompson',phone:'(Demo contact)',source:'Demo order',status:'Preparing',createdAt:Date.now()-5*60000,items:[{name:'Pepperoni Amore Pizza',qty:1,price:12.99},{name:'Breadsticks',qty:1,price:5.99}],notes:'Please confirm pickup details.'},
    {id:'DP-1041',customer:'Jordan Lee',phone:'(Demo contact)',source:'Demo order',status:'New',createdAt:Date.now()-2*60000,items:[{name:'Maui Wowie Pizza',qty:1,price:12.99},{name:'Soda',qty:2,price:1.29}],notes:''},
    {id:'DP-1040',customer:'Sam Rivera',phone:'(Demo contact)',source:'Demo order',status:'Ready',createdAt:Date.now()-22*60000,items:[{name:'Cheese Pizza',qty:2,price:7.99}],notes:'Pickup at counter.'},
    {id:'DP-1039',customer:'Alex Morgan',phone:'(Demo contact)',source:'Demo order',status:'Completed',createdAt:Date.now()-51*60000,items:[{name:'Traditional Caesar Salad',qty:1,price:4.99},{name:'Tiramisu',qty:1,price:5.99}],notes:''}
  ],
  callLog: []
};

async function loadState(){
  if(!existsSync(dataFile)){await mkdir(dataDir,{recursive:true}); await writeFile(dataFile,JSON.stringify(seed,null,2));}
  try{return JSON.parse(await readFile(dataFile,'utf8'));}catch{return structuredClone(seed);}
}
let state=await loadState();
const save=()=>writeFile(dataFile,JSON.stringify(state,null,2));
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const c of req)s+=c;if(s.length>100_000)throw Error('Request too large');return s?JSON.parse(s):{};}
const safeEqual=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
function totals(items){const subtotalCents=items.reduce((a,i)=>a+Math.round(i.price*100)*i.qty,0);const taxCents=Math.round(subtotalCents*825/10000);return{subtotal:subtotalCents/100,tax:taxCents/100,total:(subtotalCents+taxCents)/100};}
const validStatuses=['New','Preparing','Ready','Completed'];
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  try{
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,{...state,retell:{configured:Boolean(process.env.RETELL_API_KEY&&process.env.RETELL_AGENT_ID),agentIdConfigured:Boolean(process.env.RETELL_AGENT_ID),webhookSecretConfigured:Boolean(process.env.RETELL_WEBHOOK_SECRET)}});
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/orders/')){const id=decodeURIComponent(url.pathname.split('/').pop());const input=await body(req);const order=state.orders.find(o=>o.id===id);if(!order)return json(res,404,{error:'Order not found'});if(!validStatuses.includes(input.status))return json(res,400,{error:'Invalid status'});order.status=input.status;await save();return json(res,200,{order});}
    if(req.method==='POST'&&url.pathname==='/api/orders'){
      const input=await body(req);if(!Array.isArray(input.items)||input.items.length<1)return json(res,400,{error:'Add at least one item.'});
      const items=input.items.map(({id,qty})=>{const m=state.menu.find(x=>x.id===id&&x.available);if(!m||!Number.isInteger(qty)||qty<1||qty>50)throw Error('One or more items are unavailable.');return{name:m.name,qty,price:m.price};});
      const order={id:`DP-${1043+state.orders.length-4}`,customer:String(input.customer||'Demo caller').slice(0,80),phone:'(Demo call)',source:'Demo call',status:'New',createdAt:Date.now(),items,notes:String(input.notes||'').slice(0,300)};state.orders.unshift(order);await save();return json(res,201,{order,totals:totals(items)});
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/menu/')){const id=decodeURIComponent(url.pathname.split('/').pop());const input=await body(req);const item=state.menu.find(m=>m.id===id);if(!item)return json(res,404,{error:'Menu item not found'});if(typeof input.available==='boolean')item.available=input.available;if(input.price!==undefined){const p=Number(input.price);if(!Number.isFinite(p)||p<0||p>999)return json(res,400,{error:'Price must be between 0 and 999.'});item.price=Math.round(p*100)/100;}await save();return json(res,200,{item});}
    if(req.method==='POST'&&url.pathname==='/api/retell/order-tool'){
      if(!process.env.ORDER_TOOL_SECRET)return json(res,503,{error:'Order tool is disabled. Set ORDER_TOOL_SECRET on the server to enable it.'});
      if(!safeEqual(req.headers.authorization,`Bearer ${process.env.ORDER_TOOL_SECRET}`))return json(res,401,{error:'Unauthorized'});
      const input=await body(req);const args=input.args||input;const items=(args.items||[]).map(x=>({id:String(x.id||''),qty:Number(x.quantity||x.qty)}));
      const cooked=items.map(({id,qty})=>{const m=state.menu.find(x=>x.id===id&&x.available);if(!m||!Number.isInteger(qty)||qty<1||qty>50)throw Error('Invalid or unavailable menu item.');return{name:m.name,qty,price:m.price};});
      if(!cooked.length)return json(res,400,{error:'At least one valid menu item is required.'});
      const order={id:`DP-${1043+state.orders.length-4}`,customer:String(args.customer_name||'Retell caller').slice(0,80),phone:'(Retell call)',source:'Retell (test)',status:'New',createdAt:Date.now(),items:cooked,notes:String(args.notes||'').slice(0,300)};state.orders.unshift(order);await save();return json(res,201,{success:true,order_id:order.id,...totals(cooked),tax_rate:taxRate});
    }
    if(req.method==='POST'&&url.pathname==='/api/retell/webhook'){
      if(!process.env.RETELL_WEBHOOK_SECRET)return json(res,503,{error:'Webhook is disabled. Configure RETELL_WEBHOOK_SECRET on the server.'});
      const raw=await body(req);const supplied=String(req.headers['x-retell-signature']||'');
      const expected=createHmac('sha256',process.env.RETELL_WEBHOOK_SECRET).update(JSON.stringify(raw)).digest('hex');
      if(!safeEqual(supplied,expected))return json(res,401,{error:'Invalid webhook signature'});
      if(raw.event==='call_ended')state.callLog.unshift({id:raw.call?.call_id||`call-${Date.now()}`,createdAt:Date.now(),summary:'Call ended; review in Retell dashboard.',source:'Retell'});
      await save();return json(res,200,{received:true});
    }
    if(req.method==='POST'&&url.pathname==='/api/retell/call'){
      if(!process.env.RETELL_API_KEY||!process.env.RETELL_AGENT_ID)return json(res,503,{error:'Retell is not configured yet. Add RETELL_API_KEY and RETELL_AGENT_ID to .env.'});
      return json(res,501,{error:'Connect a Retell phone number in your Retell account before placing calls. No live line is configured by this demo.'});
    }
    if(req.method==='GET'&&url.pathname.startsWith('/api/'))return json(res,404,{error:'Not found'});
    const pathname=url.pathname==='/'?'/index.html':url.pathname;const filepath=path.resolve(root,'public',`.${decodeURIComponent(pathname)}`);if(!filepath.startsWith(path.resolve(root,'public')+path.sep))return json(res,403,{error:'Forbidden'});
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};const bytes=await readFile(filepath);res.writeHead(200,{'content-type':types[path.extname(filepath)]||'application/octet-stream','cache-control':'no-cache'});res.end(bytes);
  }catch(e){json(res,400,{error:e.message||'Bad request'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Dan’s Pizza demo running at http://localhost:${port}`));
