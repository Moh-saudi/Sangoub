import { adminServices } from '../server/firebaseAdmin';

async function grantAdmin(uid: string) {
  try {
    const { db } = adminServices();
    await db.collection('admins').doc(uid).set({
      grantedAt: new Date().toISOString(),
      role: 'admin',
    });
    console.log(`✅ تم تفعيل صلاحية الإدارة بنجاح في فايربيز للمعرف: ${uid}`);
  } catch (error: any) {
    console.error('❌ خطأ أثناء تفعيل الصلاحية عبر سكريبت:', error.message);
    console.log('💡 إذا كنت تستخدم Firebase Console مباشرة:');
    console.log(`   1. افتح Firestore Database > مجموعة (Collection) باسم "admins"`);
    console.log(`   2. أضف وثيقة (Document ID) واجعل المعرف: ${uid}`);
  }
}

const targetUid = process.argv[2] || 'xq90R2pRtWOPCHz2RjH6LtPQ54C2';
grantAdmin(targetUid);

