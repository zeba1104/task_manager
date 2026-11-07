const User = require('./models/User');
const Department = require('./models/Department');

const getManagerScope = async (managerId) => {
    const manager = await User.findById(managerId).select('name role department team isActive isSuspended').lean();
    if (!manager || manager.role !== 'Manager' || manager.isActive === false || manager.isSuspended) return null;

    const departmentName = String(manager.department || '').trim();
    const department = departmentName
        ? await Department.findOne({ name: { $regex: `^${departmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).populate('head', 'name email role').lean()
        : null;
    const isDepartmentHead = String(department?.head?._id || department?.head || '') === String(managerId);
    const employeeFilter = { role: 'Employee', isActive: { $ne: false }, isSuspended: { $ne: true } };
    employeeFilter.$or = [{ manager: managerId }];
    if (isDepartmentHead && departmentName) employeeFilter.$or.push({ department: departmentName });

    const employees = await User.find(employeeFilter)
        .select('name firstName lastName email phone employeeId role department designation team manager isActive isSuspended joiningDate profilePicture responsibilities createdAt')
        .populate('manager', 'name email')
        .lean();
    const memberIds = [managerId, ...employees.map((employee) => employee._id)];

    return { manager, department, isDepartmentHead, employees, memberIds };
};

module.exports = getManagerScope;