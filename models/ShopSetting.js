const mongoose = require('mongoose');

const shopSettingSchema = new mongoose.Schema({
    shopName: {
        type: String,
        required: true,
        default: 'Balouch Tailors',
        trim: true
    },
    tagline: {
        type: String,
        default: 'Gents Shalwar Qameez Specialist',
        trim: true
    },
    proprietor: {
        type: String,
        default: 'Zubair Balouch',
        trim: true
    },
    primaryPhone: {
        type: String,
        default: '0313-4389192',
        trim: true
    },
    secondaryPhone: {
        type: String,
        default: '0306-7379919',
        trim: true
    },
    address: {
        type: String,
        default: 'Hazori Bagh Road, Street 1, Muhallah Muhammadi, Near Peer Muhammad Murad Masjid, Multan',
        trim: true
    },
    logoUrl: {
        type: String,
        default: ''
    },
    logoPublicId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ShopSetting', shopSettingSchema);
