// Fields a worker is allowed to see about a customer.
// Everything NOT in this list (cnic, khataBalance, pin, ...) is hidden from workers.
const WORKER_SAFE_CUSTOMER_FIELDS =
    'customerNumber name phone whatsapp address city profileImage measurements stitchingPreferences';

// Admin gets undefined (= no restriction, all fields).
// Everyone else gets the safe list.
const customerFieldsFor = (user) =>
    user && user.role === 'admin' ? undefined : WORKER_SAFE_CUSTOMER_FIELDS;

module.exports = { customerFieldsFor };