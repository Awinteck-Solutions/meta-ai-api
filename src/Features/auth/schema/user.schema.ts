const mongoose = require('mongoose')
const Schema = mongoose.Schema;


const userSchema = new Schema({
    email: { type: String, required: true, unique: true, index: true},
    password: { type: String, required: false },
    firstname: {type: String, default: null},
    lastname: {type: String, default: null},
    phoneNumber: {type: String, default: null},
    image: {type: String, default: null},
    otp: { type: String, required: true },
    role: { type: String, default: "owner" },
    status: {
        type: String,
        enum : ['ACTIVE','DEACTIVE'],
        default: 'ACTIVE',
    },
    notificationEmail: { type: Boolean, default: true },
    notificationPush: { type: Boolean, default: false },
    notificationWeekly: { type: Boolean, default: true },
},  {timestamps: true})

const User = mongoose.model('User', userSchema);

export default User