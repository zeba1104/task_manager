const Activity = require('./models/Activity');

const logActivity = (actor, action, targetType, targetName, details = '') => {
    Activity.create({ actor, action, targetType, targetName, details })
        .catch((error) => console.error('Activity log failed:', error.message));
};

module.exports = logActivity;