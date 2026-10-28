import test from 'node:test';
import assert from 'node:assert/strict';
import { egyptMobile, nationalIdBirth, realDate, validateAccount, cairoToday, courierApprovalError } from '../src/validation/accounts.ts';
const today = '2026-10-28';
const valid = {
  fullName: 'أحمد محمد',
  email: 'ahmed@example.com',
  phone: '01012345678',
  nationalId: '29001010112345',
  emergencyPhone: '01112345678',
  currentAddress: 'القاهرة مدينة نصر شارع النصر',
  idCardAddress: 'القاهرة شارع التحرير عمارة 10',
  courierStatus: 'active',
  vehicleType: 'motorcycle',
  vehicleMake: 'دايون',
  vehicleModel: 'موديل 4',
  vehicleYear: '2024',
  vehiclePlate: 'س ع ق 194',
  drivingLicenseNumber: '123456789',
  licenseIssueDate: '2024-01-01',
  licenseExpiryDate: '2028-01-01',
  drugTestStatus: 'passed',
  drugTestDate: '2026-09-01',
  criminalRecordStatus: 'passed',
  criminalRecordDate: '2026-09-02'
};
test('Egyptian mobile normalization supports local/international/Arabic digits and rejects invalid prefixes/lengths', () => {
  for (const v of ['01012345678', '+201012345678', '00201012345678', '٠١٠١٢٣٤٥٦٧٨', '۰۱۰۱۲۳۴۵۶۷۸']) assert.equal(egyptMobile(v), '01012345678');
  for (const v of ['01312345678', '010123', '+966501234567', 'abcdefghijk', '010123456789', '+2001012345678']) assert.equal(egyptMobile(v), null);
});
test('national ID validates century, real birth date and governorate without inventing a checksum', () => {
  assert.equal(nationalIdBirth(valid.nationalId, today), '1990-01-01');
  for (const id of ['19001010112345', '29002310112345', '29001019912345', '39901010112345', '00000000000000', '2900101011234']) assert.equal(nationalIdBirth(id, today), null);
  assert.equal(nationalIdBirth('29001018812345', today), '1990-01-01');
});
test('calendar dates and Cairo day handle leap days and midnight correctly', () => {
  assert.equal(realDate('2024-02-29'), '2024-02-29');
  for (const v of ['2025-02-29', '2024-02-30', '2026-13-01', '2026-00-01', '2026-1-1']) assert.equal(realDate(v), null);
  assert.equal(cairoToday(new Date('2026-10-28T22:30:00Z')), '2026-10-29');
});
test('active courier validates cross-field dates, distinct emergency mobile and clean KYC', () => {
  assert.deepEqual(validateAccount(valid, 'courier', today).errors, {});
  for (const [field, value] of [['phone', '000'], ['emergencyPhone', valid.phone], ['nationalId', '11111111111111'], ['licenseIssueDate', '2027-01-01'], ['licenseExpiryDate', '2023-01-01'], ['drugTestDate', '2026-10-29'], ['criminalRecordDate', '1900-01-01'], ['drugTestStatus', 'pending'], ['criminalRecordStatus', 'failed'], ['vehicleYear', '2040'], ['vehiclePlate', 'whatever'], ['drivingLicenseNumber', '!!']]) assert(Object.keys(validateAccount({
    ...valid,
    [field]: value
  }, 'courier', today).errors).length, field);
});
test('pending incomplete dossiers can be stored; bicycle requires no driving licence; known failed results require dates', () => {
  const pending = {
    ...valid,
    courierStatus: 'pending',
    drugTestStatus: 'pending',
    criminalRecordStatus: 'pending',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehiclePlate: '',
    drivingLicenseNumber: '',
    licenseIssueDate: '',
    licenseExpiryDate: '',
    drugTestDate: '',
    criminalRecordDate: ''
  };
  assert.deepEqual(validateAccount(pending, 'courier', today).errors, {});
  assert.deepEqual(validateAccount({
    ...valid,
    vehicleType: 'bicycle',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehiclePlate: '',
    drivingLicenseNumber: '',
    licenseIssueDate: '',
    licenseExpiryDate: ''
  }, 'courier', today).errors, {});
  assert(validateAccount({
    ...pending,
    drugTestStatus: 'failed'
  }, 'courier', today).errors.drugTestDate);
  assert(validateAccount({
    ...valid,
    licenseExpiryDate: valid.licenseIssueDate
  }, 'courier', today).errors.licenseExpiryDate);
});
test('non-courier accounts still require real contact data but no courier KYC', () => {
  assert.deepEqual(validateAccount({
    fullName: 'مسؤول المتجر',
    email: 'STORE@example.com',
    phone: '+201012345678'
  }, 'restaurant', today).errors, {});
  assert(validateAccount({
    fullName: '1234',
    email: 'bad',
    phone: '123'
  }, 'employee', today).errors.fullName);
});
test('approval is enforced for pending profiles and re-evaluates expiry at the moment of work; legacy records are explicit', () => {
  assert(courierApprovalError({
    courierStatus: 'pending'
  }, valid, today));
  assert.equal(courierApprovalError({
    courierStatus: 'active'
  }, valid, today), null);
  assert(courierApprovalError({
    courierStatus: 'active'
  }, {
    ...valid,
    licenseExpiryDate: '2026-10-27'
  }, today));
  assert(courierApprovalError({}, {
    ...valid,
    courierStatus: 'suspended'
  }, today));
  assert.equal(courierApprovalError({}, {}, today), null);
});
