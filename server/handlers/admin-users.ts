import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin, AdminError, adminError, validId } from '../adminRequest.ts';
import { auditRecord, auditSafe, auditChangedFields } from '../audit.ts';
import { mobileCors } from '../mobileCors.ts';

const roles = ['employee','restaurant','courier','admin'];
function text(value: any, max: number, required=false) { if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new AdminError(400,'راجع البيانات المطلوبة وطول النصوص.');return value.trim(); }
export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store'); if(mobileCors(req,res))return;
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  let context: Awaited<ReturnType<typeof requireAdmin>>|undefined;let journalStarted=false;
  try {
    const {auth,db,actor}=context=await requireAdmin(req); const input=req.body||{};
    if(input.action==='list') {
      if(input.pageToken!==undefined&&(typeof input.pageToken!=='string'||input.pageToken.length>4096))throw new AdminError(400,'مؤشر الصفحة غير صالح.');
      const search=typeof input.search==='string'?input.search.trim():'';
      if(search.length>160)throw new AdminError(400,'نص البحث طويل.');
      const result=search?{users:[await (search.includes('@')?auth.getUserByEmail(search):auth.getUser(search))],pageToken:undefined}:await auth.listUsers(50,input.pageToken||undefined);
      const users=await Promise.all(result.users.map(async user=>{
        const [profile,admin,staff]=await db.getAll(db.doc('users/'+user.uid),db.doc('admins/'+user.uid),db.doc('staff/'+user.uid));
        const uData=profile.data()||{};
        const sData=staff.data()||{};
        return {
          uid:user.uid,
          email:user.email||'',
          fullName:uData.fullName||user.displayName||'',
          phone:uData.phone||user.phoneNumber||'',
          role:admin.exists?'admin':sData.role||'employee',
          storeId:sData.storeId||uData.storeId||'',
          duty:sData.duty||'manager',
          disabled:user.disabled,
          emailVerified:user.emailVerified,
          providers:user.providerData.map(p=>p.providerId),
          createdAt:user.metadata.creationTime,
          lastSignInAt:user.metadata.lastSignInTime||'',
          ministry:uData.ministry||'',
          floorNumber:uData.floorNumber||'',
          roomNumber:uData.roomNumber||'',
          walletBalance:uData.walletBalance||0,
          nickname:uData.nickname||'',
          nationalId:uData.nationalId||'',
          emergencyPhone:uData.emergencyPhone||'',
          currentAddress:uData.currentAddress||uData.locationAddress||'',
          locationAddress:uData.locationAddress||uData.currentAddress||'',
          idCardAddress:uData.idCardAddress||'',
          vehicleType:uData.vehicleType||sData.vehicleType||'',
          vehicleMake:uData.vehicleMake||'',
          vehicleModel:uData.vehicleModel||'',
          vehiclePlate:uData.vehiclePlate||sData.vehiclePlate||'',
          drivingLicenseNumber:uData.drivingLicenseNumber||'',
          licenseExpiryDate:uData.licenseExpiryDate||'',
          drugTestStatus:uData.drugTestStatus||'pending',
          drugTestDate:uData.drugTestDate||'',
          criminalRecordStatus:uData.criminalRecordStatus||'pending',
          criminalRecordDate:uData.criminalRecordDate||'',
          hasThermalBox:Boolean(uData.hasThermalBox),
          hasThermalBackpack:Boolean(uData.hasThermalBackpack),
          courierStatus:uData.courierStatus||'active',
          coordinates:uData.coordinates||null,
          coverageRadiusKm:uData.coverageRadiusKm||5,
          preferredDeliveryMethod:uData.preferredDeliveryMethod||'auto'
        };
      }));
      return res.status(200).json({users,nextPageToken:result.pageToken||null});
    }
    if(!['create','update','role','disable','enable','revoke','reset','delete'].includes(input.action))throw new AdminError(400,'عملية غير معروفة.');
    const reason=text(input.reason||'',500,true);if(reason.length<5)throw new AdminError(400,'اكتب سببًا واضحًا للتغيير.');
    let uid=input.uid;
    const requestedRole=input.action==='create'||input.action==='role'?input.role:undefined;
    if((input.action==='create'||input.action==='role')&&!roles.includes(requestedRole))throw new AdminError(400,'اختر دورًا صحيحًا.');
    const duty=input.duty||'preparer';
    if(requestedRole==='restaurant'&&!['manager','preparer'].includes(duty))throw new AdminError(400,'اختر مهمة فريق المتجر.');
    if(requestedRole==='restaurant'){validId(input.storeId);if(!(await db.doc('stores/'+input.storeId).get()).exists)throw new AdminError(400,'المتجر غير موجود.');}
    let fullName='',email='',profilePatch:any={};
    if(input.action==='create'||input.action==='update') {
      fullName=text(input.fullName,120,true);email=text(input.email,160,true);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AdminError(400,'البريد غير صالح.');
      profilePatch={
        fullName,
        email,
        phone:text(input.phone||'',30),
        ministry:text(input.ministry||'',120),
        floorNumber:text(input.floorNumber||'',60),
        roomNumber:text(input.roomNumber||'',80),
        nickname:text(input.nickname||'',80),
        nationalId:text(input.nationalId||'',20),
        emergencyPhone:text(input.emergencyPhone||'',30),
        currentAddress:text(input.currentAddress||input.locationAddress||'',250),
        locationAddress:text(input.locationAddress||input.currentAddress||'',250),
        idCardAddress:text(input.idCardAddress||'',200),
        vehicleType:text(input.vehicleType||'',40),
        vehicleMake:text(input.vehicleMake||'',60),
        vehicleModel:text(input.vehicleModel||'',60),
        vehiclePlate:text(input.vehiclePlate||'',30),
        drivingLicenseNumber:text(input.drivingLicenseNumber||'',60),
        licenseExpiryDate:text(input.licenseExpiryDate||'',30),
        drugTestStatus:['passed','failed','pending'].includes(input.drugTestStatus)?input.drugTestStatus:'pending',
        drugTestDate:text(input.drugTestDate||'',30),
        criminalRecordStatus:['passed','failed','pending'].includes(input.criminalRecordStatus)?input.criminalRecordStatus:'pending',
        criminalRecordDate:text(input.criminalRecordDate||'',30),
        hasThermalBox:input.hasThermalBox===true||input.hasThermalBox==='true'||input.hasThermalBox==='on',
        hasThermalBackpack:input.hasThermalBackpack===true||input.hasThermalBackpack==='true'||input.hasThermalBackpack==='on',
        courierStatus:['active','pending','suspended'].includes(input.courierStatus)?input.courierStatus:'active',
        coverageRadiusKm:Number(input.coverageRadiusKm)||5,
        preferredDeliveryMethod:['bicycle','motorcycle','car','auto'].includes(input.preferredDeliveryMethod)?input.preferredDeliveryMethod:'auto'
      };
      if (input.latitude !== undefined && input.longitude !== undefined && input.latitude !== '' && input.longitude !== '') {
        const lat = Number(input.latitude);
        const lng = Number(input.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          profilePatch.coordinates = { latitude: lat, longitude: lng };
        }
      }
    }
    if(input.action==='create')uid='ct_'+randomBytes(16).toString('hex');else validId(uid);
    if(uid===actor.uid&&['role','disable','delete','revoke'].includes(input.action))throw new AdminError(409,'لا يمكنك تغيير صلاحيتك أو تعطيل حسابك من الجلسة الحالية. استخدم مديرًا آخر.');
    if(input.action==='delete'&&input.confirmation!==uid)throw new AdminError(400,'أدخل UID لتأكيد حذف الحساب.');
    const log=db.collection('auditLogs').doc();const lock=db.doc('adminUserLocks/'+uid);
    let target=input.action==='create'?null:await auth.getUser(uid);
    let protectAccess=['create','role','disable','delete','revoke'].includes(input.action)||(input.action==='update'&&email!==target?.email);
    let authBefore=target?{uid:target.uid,email:target.email||'',displayName:target.displayName||'',disabled:target.disabled,emailVerified:target.emailVerified}:null;
    const before=await db.runTransaction(async tx=>{
      const [own,existingLock,profile,admin,staff,admins,control,access]=await Promise.all([tx.get(db.doc('admins/'+actor.uid)),tx.get(lock),tx.get(db.doc('users/'+uid)),tx.get(db.doc('admins/'+uid)),tx.get(db.doc('staff/'+uid)),tx.get(db.collection('admins')),tx.get(db.doc('adminControl/membership')),tx.get(db.doc('accountAccess/'+uid))]);
      if(control.data()?.operationId&&['create','role','disable','delete'].includes(input.action))throw new AdminError(409,'هناك تغيير صلاحيات قيد التنفيذ. راجع السجل ثم حاول مجددًا.');
      if(!own.exists)throw new AdminError(403,'انتهت صلاحية الإدارة.');
      if(existingLock.exists)throw new AdminError(409,'هناك عملية معلّقة على هذا الحساب. راجع سجل التدقيق قبل المحاولة مجددًا.');
      if(input.action!=='create'){target=await auth.getUser(uid);authBefore={uid:target.uid,email:target.email||'',displayName:target.displayName||'',disabled:target.disabled,emailVerified:target.emailVerified};protectAccess=['role','disable','delete','revoke'].includes(input.action)||(input.action==='update'&&email!==target.email);}
      if(admin.exists&&['role','disable','delete'].includes(input.action)&&admins.size<=1)throw new AdminError(409,'لا يمكن إزالة آخر مدير.');
      if(['role','disable','delete'].includes(input.action)) {
        if(input.action==='delete'&&Number(profile.data()?.walletBalance||0)!==0)throw new AdminError(409,'يجب تسوية رصيد المستخدم قبل حذف الحساب.');
        const customerOrders=await tx.get(db.collection('orders').where('profileId','==',uid));
        const assignments=await tx.get(db.collection('orders').where('courierId','==',uid));
        const kitchen=staff.data()?.role==='restaurant'?await tx.get(db.collection('orders').where('storeIds','array-contains',staff.data()!.storeId)):null;
        if([...assignments.docs,...customerOrders.docs,...(kitchen?.docs||[])].some(doc=>!['delivered','cancelled'].includes(doc.data().orderStatus)))throw new AdminError(409,'أعد تعيين الطلبات النشطة قبل تغيير دور الحساب أو تعطيله.');
      }
      const previous={auth:authBefore,profile:profile.data()||null,role:admin.exists?'admin':staff.data()?.role||'employee',staff:staff.data()||null,access:access.data()||null};
      if(protectAccess)tx.set(db.doc('accountAccess/'+uid),{operationLocked:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      tx.create(lock,{operationId:log.id,action:input.action,createdAt:FieldValue.serverTimestamp()});
      tx.create(log,{...auditRecord(actor,'user.'+input.action,'users',uid,previous,null,reason),status:'pending',requestedChange:auditSafe(input)});
      // Serialize changes to admin membership, including across different UIDs.
      if(['create','role','disable','delete'].includes(input.action))tx.set(db.doc('adminControl/membership'),{operationId:log.id,updatedAt:FieldValue.serverTimestamp()});
      return previous;
    });
    journalStarted=true;
    let authChanged=false;let authAttempted=false;
    try {
      let resetLink:string|undefined;
      if(input.action==='create'){authAttempted=true;await auth.createUser({uid,email,displayName:fullName,password:randomBytes(32).toString('base64url'),emailVerified:false});authChanged=true;if(requestedRole!=='employee')resetLink=await auth.generatePasswordResetLink(email);}
      if(input.action==='update'){authAttempted=true;await auth.updateUser(uid,{email,displayName:fullName,...(email!==target!.email?{emailVerified:false}:{})});authChanged=true;}
      if(input.action==='disable'||input.action==='enable'){authAttempted=true;await auth.updateUser(uid,{disabled:input.action==='disable'});authChanged=true;}
      if(['disable','revoke','role'].includes(input.action)||(input.action==='update'&&email!==target?.email)){authAttempted=true;await auth.revokeRefreshTokens(uid);authChanged=true;}
      if(input.action==='reset'){if(!target!.email)throw new AdminError(400,'الحساب لا يحتوي بريدًا لاستعادة الوصول.');resetLink=await auth.generatePasswordResetLink(target!.email);}
      if(input.action==='delete'){authAttempted=true;await auth.deleteUser(uid);authChanged=true;}
      await db.runTransaction(async tx=>{
        const profile=await tx.get(db.doc('users/'+uid));
        let after:any={...before,auth:authBefore?{...authBefore}:null};
        if(input.action==='create'||input.action==='update'){
          const data={...profilePatch,uid,...(!profile.exists?{role:requestedRole||'employee',walletBalance:0,createdAt:FieldValue.serverTimestamp()}:{}),updatedAt:FieldValue.serverTimestamp()};
          tx.set(db.doc('users/'+uid),data,{merge:true});after.profile={...(profile.data()||{}),...data};after.auth={uid,email,displayName:fullName,disabled:false,...(input.action==='update'?{disabled:target!.disabled}:{}),emailVerified:input.action==='create'?false:email===target!.email&&target!.emailVerified};
        }
        if(input.action==='create'||input.action==='role'){
          tx.delete(db.doc('admins/'+uid));tx.delete(db.doc('staff/'+uid));
          after.staff=null;
          if(requestedRole==='admin')tx.set(db.doc('admins/'+uid),{active:true,grantedBy:actor.uid,updatedAt:FieldValue.serverTimestamp()});
          if(requestedRole==='courier'||requestedRole==='restaurant'){const assignment={role:requestedRole,name:fullName||profile.data()?.fullName||target?.displayName||'',phone:profile.data()?.phone||profilePatch.phone||'',vehicleType:profilePatch.vehicleType||profile.data()?.vehicleType||'',vehiclePlate:profilePatch.vehiclePlate||profile.data()?.vehiclePlate||'',...(requestedRole==='restaurant'?{storeId:input.storeId,duty}:{}),updatedAt:FieldValue.serverTimestamp()};tx.set(db.doc('staff/'+uid),assignment);after.staff=assignment;}
          const targetStoreId = input.storeId || before.staff?.storeId;
          if ((input.action === 'create' || input.action === 'update' || input.action === 'role') && targetStoreId && (requestedRole === 'restaurant' || profile.data()?.role === 'restaurant' || input.role === 'restaurant')) {
            const storeUpdates: any = { updatedAt: FieldValue.serverTimestamp() };
            if (profilePatch.coordinates) storeUpdates.coordinates = profilePatch.coordinates;
            if (profilePatch.locationAddress || profilePatch.currentAddress) {
              storeUpdates.locationInDistrict = profilePatch.locationAddress || profilePatch.currentAddress;
              storeUpdates.preciseAddress = profilePatch.locationAddress || profilePatch.currentAddress;
            }
            if (profilePatch.coverageRadiusKm) storeUpdates.coverageRadiusKm = profilePatch.coverageRadiusKm;
            if (profilePatch.preferredDeliveryMethod) storeUpdates.preferredDeliveryMethod = profilePatch.preferredDeliveryMethod;
            tx.set(db.doc('stores/' + targetStoreId), storeUpdates, { merge: true });
          }
          tx.set(db.doc('users/'+uid),{...(!profile.exists&&input.action!=='create'?{uid,fullName:target?.displayName||'',email:target?.email||'',phone:target?.phoneNumber||'',ministry:'',floorNumber:'',roomNumber:'',walletBalance:0,createdAt:FieldValue.serverTimestamp()}:{}),role:requestedRole,updatedAt:FieldValue.serverTimestamp()},{merge:true});after.role=requestedRole;after.profile={...(after.profile||{uid,fullName:target?.displayName||'',email:target?.email||'',phone:target?.phoneNumber||'',ministry:'',floorNumber:'',roomNumber:'',walletBalance:0}),role:requestedRole};
        }
        if(input.action==='disable'||input.action==='delete'){tx.delete(db.doc('admins/'+uid));tx.delete(db.doc('staff/'+uid));after.role='employee';after.staff=null;if(after.profile)after.profile.role='employee';if(profile.exists)tx.update(db.doc('users/'+uid),{role:'employee',updatedAt:FieldValue.serverTimestamp()});}
        if(input.action==='disable'||input.action==='enable'){after.auth.disabled=input.action==='disable';}
        const revocation=['role','disable','delete','revoke'].includes(input.action)||(input.action==='update'&&email!==target?.email);
        if(protectAccess||input.action==='enable'){
          after.access={...(before.access||{}),operationLocked:false,...(revocation?{disabled:['disable','delete'].includes(input.action)||Boolean(target?.disabled),revokedBefore:Math.floor(Date.now()/1000)}:{}),...(input.action==='create'||input.action==='enable'?{disabled:false}:{})};
          tx.set(db.doc('accountAccess/'+uid),{...after.access,updatedAt:FieldValue.serverTimestamp()},{merge:true});
        }
        if(input.action==='delete'){
          tx.set(db.doc('users/'+uid),{fullName:'حساب محذوف',email:'',phone:'',ministry:'',floorNumber:'',roomNumber:'',avatarUrl:'',coordinates:FieldValue.delete(),role:'employee',deletedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});after={deleted:true,uid,access:after.access};
        }
        if(input.action==='update'&&before.staff){const change={name:fullName,phone:profilePatch.phone,vehicleType:profilePatch.vehicleType||before.staff.vehicleType||'',vehiclePlate:profilePatch.vehiclePlate||before.staff.vehiclePlate||'',updatedAt:FieldValue.serverTimestamp()};tx.update(db.doc('staff/'+uid),change);after.staff={...before.staff,...change};}
        tx.update(log,{status:'success',after:auditSafe(after),changedFields:auditChangedFields(before,after),completedAt:FieldValue.serverTimestamp()});tx.delete(lock);if(['create','role','disable','delete'].includes(input.action))tx.delete(db.doc('adminControl/membership'));
      });
      return res.status(200).json({ok:true,uid,...(resetLink?{resetLink}:{})});
    }catch(error){
      const definitive=['auth/email-already-exists','auth/uid-already-exists','auth/user-not-found','auth/invalid-email','auth/invalid-display-name','auth/invalid-password'].includes(String((error as any)?.code||''));
      const uncertain=authChanged||(authAttempted&&!definitive&&!(error instanceof AdminError));
      await log.update({status:uncertain?'partial':'failed',errorCode:error instanceof AdminError?'validation':String((error as any)?.code||'operation-failed').slice(0,100),completedAt:FieldValue.serverTimestamp()});
      if(!uncertain){const batch=db.batch();batch.delete(lock);if(protectAccess){if(before.access)batch.set(db.doc('accountAccess/'+uid),before.access);else batch.delete(db.doc('accountAccess/'+uid));}if(['create','role','disable','delete'].includes(input.action))batch.delete(db.doc('adminControl/membership'));await batch.commit();}
      if(uncertain)throw new AdminError(503,'قد تكون العملية نُفذت جزئيًا. راجع سجل التدقيق قبل تكرارها. معرّف العملية: '+log.id);
      throw error;
    }
  }catch(error){
    if(context&&!journalStarted&&req.body?.action!=='list'){
      try{await context.db.collection('auditLogs').add({...auditRecord(context.actor,'user.'+String(req.body?.action||'invalid').slice(0,40),'users',String(req.body?.uid||'new').slice(0,128),null,null,String(req.body?.reason||'').slice(0,500)),status:'blocked',requestedChange:auditSafe(req.body),errorCode:error instanceof AdminError?'http-'+error.status:'validation'});}catch{}
    }
    return adminError(res,error);
  }
}
