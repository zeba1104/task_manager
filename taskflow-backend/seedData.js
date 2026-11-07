const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Department = require('./models/Department');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Announcement = require('./models/Announcement');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'taskflow' });
    console.log('Connected to Atlas for seeding...');

    // Find users
    const admin = await User.findOne({ role: 'Admin' });
    const manager = await User.findOne({ role: 'Manager' });
    const employee = await User.findOne({ role: 'Employee' });

    const adminId = admin ? admin._id : (manager ? manager._id : null);

    // 1. Ensure Department exists
    let dept = await Department.findOne({ name: 'General' });
    if (!dept) {
        dept = await Department.create({
            name: 'General',
            code: 'GEN',
            description: 'Core General Department',
            head: manager ? manager._id : null,
            createdBy: adminId,
            isActive: true,
        });
        console.log('Created General Department');
    }

    // 2. Setup Manager Bushra
    if (manager) {
        manager.department = 'General';
        manager.team = 'Operations';
        await manager.save();
        dept.head = manager._id;
        await dept.save();
        console.log(`Updated Manager: ${manager.name} as head of General`);
    }

    // 3. Link Employee Zeba to Manager Bushra
    if (employee && manager) {
        employee.department = 'General';
        employee.team = 'Operations';
        employee.manager = manager._id;
        employee.designation = 'Senior Associate';
        employee.employeeId = 'EMP-1001';
        await employee.save();
        console.log(`Updated Employee: ${employee.name} under Manager ${manager.name}`);
    }

    // 4. Create sample projects if none exist
    const projectCount = await Project.countDocuments();
    let sampleProject = null;
    if (projectCount === 0 && manager) {
        sampleProject = await Project.create({
            name: 'Taskflow Platform Upgrade',
            description: 'Core system enhancements, dynamic workflow, and UI redesign.',
            objectives: 'Improve user experience and dynamic workflow across all roles.',
            requirements: 'Responsive UI, dark mode toggle, resilient backend API.',
            priority: 'High',
            status: 'In Progress',
            department: dept._id,
            manager: manager._id,
            teamLead: manager._id,
            createdBy: manager._id,
            assignedEmployees: employee ? [employee._id] : [],
            startDate: new Date(),
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            progress: 65,
            milestones: [
                { title: 'Backend API Hardening', dueDate: new Date(), completed: true },
                { title: 'Dark Mode & Alignment', dueDate: new Date(), completed: true },
                { title: 'User Testing', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), completed: false },
            ],
        });
        console.log('Created sample project: Taskflow Platform Upgrade');
    }

    // 5. Create sample tasks if none exist
    const taskCount = await Task.countDocuments();
    if (taskCount === 0 && employee && manager) {
        await Task.create([
            {
                title: 'Review Frontend Design & Alignment',
                description: 'Audit all headers, cards, and buttons for responsive alignment.',
                status: 'completed',
                priority: 'high',
                category: 'Design',
                project: sampleProject ? sampleProject.name : 'Taskflow Platform Upgrade',
                user: employee._id,
                assignedBy: manager._id,
                deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                reviewStatus: 'approved',
            },
            {
                title: 'Implement Dark Theme Toggle',
                description: 'Provide persistent dark mode with theme toggle in headers.',
                status: 'in-process',
                priority: 'medium',
                category: 'Development',
                project: sampleProject ? sampleProject.name : 'Taskflow Platform Upgrade',
                user: employee._id,
                assignedBy: manager._id,
                deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
                reviewStatus: 'none',
            },
            {
                title: 'Submit Project Milestone Progress',
                description: 'Prepare progress summary report for manager review.',
                status: 'in-review',
                priority: 'high',
                category: 'Documentation',
                project: sampleProject ? sampleProject.name : 'Taskflow Platform Upgrade',
                user: employee._id,
                assignedBy: manager._id,
                deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                reviewStatus: 'submitted',
                submissionNotes: 'All milestone items verified and ready for manager sign-off.',
                submittedAt: new Date(),
            },
        ]);
        console.log('Created sample tasks for employee');
    }

    // 6. Ensure Announcement exists
    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0 && manager) {
        await Announcement.create({
            title: 'Welcome to the New Taskflow Workspace',
            body: 'We have updated all dashboard features for Admin, Manager, and Employee with real-time sync and dark mode.',
            audience: 'all',
            publishedBy: manager._id,
            publishedAt: new Date(),
        });
        console.log('Created welcome announcement');
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
});
