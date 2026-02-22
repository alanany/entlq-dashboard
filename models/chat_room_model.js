const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    }],
    type: {
        type: String,
        enum: ['course', 'support', 'direct'],
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: function() { return this.type === 'course'; }
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;
