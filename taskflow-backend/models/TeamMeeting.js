const mongoose = require('mongoose');

const teamMeetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    meetingType: {
        type: String,
        enum: ['team_meeting', 'project_sync', 'one_on_one', 'important_event', 'general'],
        default: 'team_meeting',
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        default: null,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        default: null,
    },
    team: {
        type: String,
        trim: true,
        default: '',
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null,
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    meetingLink: {
        type: String,
        trim: true,
        default: '',
    },
    location: {
        type: String,
        trim: true,
        default: '',
    },
}, { timestamps: true });

teamMeetingSchema.index({ startTime: 1 });
teamMeetingSchema.index({ department: 1 });

module.exports = mongoose.model('TeamMeeting', teamMeetingSchema);
