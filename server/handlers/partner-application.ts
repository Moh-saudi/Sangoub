import { createHash } from 'node:crypto';
import { requireSameOriginJson } from '../publicRequest.ts';
import { AdminError, adminError } from '../adminRequest.ts';
import { supabaseAdminClient } from '../supabaseAdmin.ts';

const fields = ['id','businessName','partnerType','contactName','phone','branchesCount','locationInCapital','notes','status','createdAt'];
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    requireSameOriginJson(req);
    const input=req.body;
    if(!input||Object.keys(input).some(key=>!fields.includes(key))||typeof input.id!=='string'||!/^partner-[0-9]{10,16}$/.test(input.id))
      throw new AdminError(400,'بيانات طلب الشراكة غير صالحة.');
    const textLimits:Record<string,number>={businessName:120,partnerType:80,contactName:120,phone:30,branchesCount:20,locationInCapital:240,notes:1000};
    for(const [field,limit] of Object.entries(textLimits))if(typeof input[field]!=='string'||input[field].trim().length<1||input[field].length>limit)
      throw new AdminError(400,'راجع بيانات النشاط ووسيلة التواصل.');
    const payload:Record<string,string>={...Object.fromEntries(Object.keys(textLimits).map(field=>[field,input[field].trim()])),status:'pending'};
    const normalizedPhone=payload.phone.replace(/[^0-9+]/g,'').toLowerCase();
    if(normalizedPhone.length<8)throw new AdminError(400,'رقم الهاتف غير صالح.');
    const phoneHash=createHash('sha256').update(normalizedPhone).digest('hex');
    const {data,error}=await supabaseAdminClient().rpc('create_sangoub_partner_application',{p_id:input.id,p_payload:payload,p_phone_hash:phoneHash});
    if(error){
      if(error.message?.includes('PARTNER_APPLICATION_RATE_LIMIT'))throw new AdminError(429,'بلغت الحد اليومي لطلبات الشراكة.');
      if(error.code==='23505')return res.status(200).json({ok:true,id:input.id});
      throw new AdminError(503,'تعذر حفظ طلب الشراكة في Supabase.');
    }
    return res.status(200).json({ok:true,id:data?.id||input.id});
  } catch(error){ return adminError(res,error); }
}
