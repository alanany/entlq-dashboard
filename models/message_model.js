const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatRoom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'file'],
        default: 'text'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }]
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
