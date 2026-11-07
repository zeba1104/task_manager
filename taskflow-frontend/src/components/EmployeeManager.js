import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from '../api/axios';
import Swal from '../utils/swalConfig';
import { getDepartments } from '../api/adminApi';
import * as XLSX from 'xlsx';
import {
    Download,
    Eye,
    FileUp,
    Printer,
    Search,
    UserRound,
    Users,
    UserPlus,
    ShieldCheck,
    CheckCircle2,
    Edit3,
    Trash2,
    Mail,
    RefreshCw,
    X,
    Briefcase,
    Phone,
    KeyRound,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Camera
} from 'lucide-react';

function EmployeeAvatar({ employee, size = 38 }) {
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        let active = true;
        let objectUrl = '';
        if (!employee?.profilePicture) {
            setImageUrl('');
            return () => { active = false; };
        }
        axios.get(`/users/${employee._id}/profile-picture`, { responseType: 'blob' })
            .then((response) => {
                objectUrl = URL.createObjectURL(response.data);
                if (active) setImageUrl(objectUrl);
            })
            .catch(() => { if (active) setImageUrl(''); });
        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [employee?._id, employee?.profilePicture]);

    return (
        <div
            className="employee-avatar-wrapper"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: employee?.role === 'Manager'
                    ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                    : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                fontWeight: 600,
                fontSize: `${Math.round(size * 0.4)}px`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
            }}
        >
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <span>{employee?.name?.[0]?.toUpperCase() || employee?.firstName?.[0]?.toUpperCase() || '?'}</span>
            )}
        </div>
    );
}

function EmployeeManager({ fetchEmployees, setView, tasks = [], initialShowForm = false, onInitialShowHandled }) {
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Active subtab: 'employees' or 'managers'
    const [activeDirectoryTab, setActiveDirectoryTab] = useState('employees');

    // Modals: null | 'create-employee' | 'create-manager' | 'edit-user'
    const [modalMode, setModalMode] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [viewingManager, setViewingManager] = useState(null);
    const [selectedProfile, setSelectedProfile] = useState(null);

    // Search, Filters & Sorting
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        department: '',
        team: '',
        status: '',
        employmentType: ''
    });
    const [sortField, setSortField] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form fields state
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        employeeId: '',
        dateOfBirth: '',
        department: '',
        designation: '',
        team: '',
        teams: [],
        manager: '',
        joiningDate: new Date().toISOString().slice(0, 10),
        employmentType: 'Full-time',
        employmentStatus: 'Active',
        role: 'Employee',
        isActive: true,
        isSuspended: false,
        passwordMode: 'auto', // 'auto' | 'manual'
        password: '',
        confirmPassword: '',
    });

    const [formErrors, setFormErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [profilePictureFile, setProfilePictureFile] = useState(null);
    const [profilePicturePreview, setProfilePicturePreview] = useState('');
    const [importing, setImporting] = useState(false);
    const importInputRef = React.useRef(null);

    // Fetch users and departments
    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            const [res, departmentRes] = await Promise.all([
                axios.get('/users'),
                getDepartments()
            ]);
            setUsers(res.data);
            setDepartments(departmentRes.data);
            if (fetchEmployees) fetchEmployees();
        } catch (err) {
            setError('Failed to load organizational directory.');
        } finally {
            setLoading(false);
        }
    }, [fetchEmployees]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // Generate unique ID helper (e.g. EMP-1045 or MGR-2034)
    const generateUniqueId = useCallback((role) => {
        const prefix = role === 'Manager' ? 'MGR' : 'EMP';
        const existingIds = new Set(users.map((u) => u.employeeId));
        let candidate = '';
        let attempts = 0;
        do {
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            candidate = `${prefix}-${randomNum}`;
            attempts++;
        } while (existingIds.has(candidate) && attempts < 50);
        return candidate;
    }, [users]);

    // Open create form for specific role
    const handleOpenCreateForm = useCallback((targetRole = 'Employee') => {
        setEditingUser(null);
        setProfilePictureFile(null);
        setProfilePicturePreview('');
        setFormErrors({});

        const defaultDept = departments[0]?.name || 'General';
        const initialId = generateUniqueId(targetRole);

        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            employeeId: initialId,
            dateOfBirth: '',
            department: defaultDept,
            designation: '',
            team: '',
            teams: [],
            manager: '',
            joiningDate: new Date().toISOString().slice(0, 10),
            employmentType: 'Full-time',
            employmentStatus: 'Active',
            role: targetRole,
            isActive: true,
            isSuspended: false,
            passwordMode: 'auto',
            password: '',
            confirmPassword: '',
        });

        setModalMode(targetRole === 'Manager' ? 'create-manager' : 'create-employee');
    }, [departments, generateUniqueId]);

    // Initial form open handler
    useEffect(() => {
        if (initialShowForm) {
            const role = typeof initialShowForm === 'string' ? initialShowForm : 'Employee';
            handleOpenCreateForm(role);
            onInitialShowHandled?.();
        }
    }, [initialShowForm, onInitialShowHandled, handleOpenCreateForm]);

    // Open edit form
    const handleOpenEditForm = (user) => {
        setEditingUser(user);
        setProfilePictureFile(null);
        setProfilePicturePreview('');
        setFormErrors({});

        const nameParts = String(user.name || '').trim().split(/\s+/);
        const firstName = user.firstName || nameParts[0] || '';
        const lastName = user.lastName || nameParts.slice(1).join(' ') || '';

        setFormData({
            firstName,
            lastName,
            email: user.email || '',
            phone: user.phone || '',
            employeeId: user.employeeId || '',
            dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
            department: user.department || departments[0]?.name || 'General',
            designation: user.designation || '',
            team: user.team || '',
            teams: Array.isArray(user.teams) ? user.teams : [],
            manager: user.manager?._id || user.manager || '',
            joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().slice(0, 10) : '',
            employmentType: user.employmentType || 'Full-time',
            employmentStatus: user.employmentStatus || 'Active',
            role: user.role || 'Employee',
            isActive: user.isActive !== false,
            isSuspended: user.isSuspended === true,
            passwordMode: 'keep',
            password: '',
            confirmPassword: '',
        });

        setModalMode('edit-user');
    };

    // Handle department change with dependent cascade
    const handleDepartmentChange = (newDeptName) => {
        const selectedDeptDoc = departments.find((d) => d.name === newDeptName);
        const availableTeams = selectedDeptDoc?.teams || [];

        setFormData((prev) => ({
            ...prev,
            department: newDeptName,
            team: availableTeams.includes(prev.team) ? prev.team : '',
            teams: prev.teams.filter((t) => availableTeams.includes(t)),
            // If the currently selected reporting manager does not match this department, reset unless they are an org-wide manager
            manager: prev.manager
        }));
    };

    // Validate form fields
    const validateForm = () => {
        const errors = {};
        const { firstName, lastName, email, phone, employeeId, role, department, passwordMode, password, confirmPassword } = formData;

        if (!firstName.trim()) {
            errors.firstName = 'First name is required.';
        } else if (!/^[a-zA-Z\s'-]+$/.test(firstName.trim())) {
            errors.firstName = 'First name can only contain letters, spaces, or hyphens.';
        }

        if (lastName.trim() && !/^[a-zA-Z\s'-]+$/.test(lastName.trim())) {
            errors.lastName = 'Last name can only contain letters, spaces, or hyphens.';
        }

        if (!email.trim()) {
            errors.email = 'Email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = 'Please provide a valid email address.';
        } else {
            const emailLower = email.trim().toLowerCase();
            const duplicateEmail = users.find((u) => u._id !== editingUser?._id && u.email?.toLowerCase() === emailLower);
            if (duplicateEmail) errors.email = 'This email address is already registered.';
        }

        if (!phone.trim()) {
            errors.phone = 'Phone number is required.';
        } else if (!/^[0-9+()\s-]{7,20}$/.test(phone.trim())) {
            errors.phone = 'Please provide a valid phone number format.';
        }

        if (!employeeId.trim()) {
            errors.employeeId = `${role === 'Manager' ? 'Manager' : 'Employee'} ID is required.`;
        } else if (!/^[A-Za-z0-9-]{3,24}$/.test(employeeId.trim())) {
            errors.employeeId = 'Profile ID must be 3-24 characters (letters, numbers, hyphens).';
        } else {
            const idUpper = employeeId.trim().toUpperCase();
            const duplicateId = users.find((u) => u._id !== editingUser?._id && u.employeeId?.toUpperCase() === idUpper);
            if (duplicateId) errors.employeeId = 'This Profile ID is already in use.';
        }

        if (!department) {
            errors.department = 'Department selection is required.';
        }

        if (passwordMode === 'manual') {
            if (!password || password.length < 8) {
                errors.password = 'Password must be at least 8 characters long.';
            } else if (!/(?=.*[0-9])(?=.*[a-zA-Z])/.test(password)) {
                errors.password = 'Password must include both letters and numbers.';
            }
            if (password !== confirmPassword) {
                errors.confirmPassword = 'Passwords do not match.';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit form (create or edit)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            Swal.fire({
                title: 'Check Form Details',
                text: 'Please resolve the highlighted errors before proceeding.',
                icon: 'warning'
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: formData.phone.trim(),
                employeeId: formData.employeeId.trim().toUpperCase(),
                department: formData.department,
                designation: formData.designation.trim(),
                team: formData.team.trim(),
                teams: formData.teams,
                role: formData.role,
                joiningDate: formData.joiningDate || null,
                dateOfBirth: formData.dateOfBirth || null,
                employmentType: formData.employmentType,
                employmentStatus: formData.employmentStatus,
                isActive: formData.isActive,
                isSuspended: formData.isSuspended,
            };

            // Only set manager if Employee role
            if (formData.role === 'Employee') {
                payload.manager = formData.manager || null;
            } else {
                payload.manager = null;
            }

            // Password handling
            if (formData.passwordMode === 'manual' && formData.password) {
                payload.password = formData.password;
            }

            let savedUserId = null;

            if (editingUser) {
                await axios.put(`/users/${editingUser._id}`, payload);
                savedUserId = editingUser._id;
                Swal.fire({
                    title: 'Account Updated!',
                    text: `${formData.firstName}'s account information has been saved successfully.`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const res = await axios.post('/users', payload);
                savedUserId = res.data.user?._id;

                const emailNotice = res.data.credentialsSent
                    ? 'Login credentials and temporary password were automatically sent to ' + payload.email
                    : 'Account created. Note: SMTP email dispatch was not configured; you can resend credentials later from the directory table.';

                Swal.fire({
                    title: `${formData.role} Created Successfully!`,
                    text: emailNotice,
                    icon: res.data.credentialsSent ? 'success' : 'info',
                    confirmButtonText: 'Great'
                });
            }

            // Upload profile picture if chosen
            if (profilePictureFile && savedUserId) {
                const upload = new FormData();
                upload.append('picture', profilePictureFile);
                await axios.post(`/users/${savedUserId}/profile-picture`, upload).catch(() => {});
            }

            setModalMode(null);
            setEditingUser(null);
            setProfilePictureFile(null);
            setProfilePicturePreview('');
            await loadUsers();
        } catch (err) {
            console.error('Account save error:', err);
            const serverMsg = err.response?.data?.message || err.message || 'Error processing account.';
            Swal.fire({
                title: 'Operation Failed',
                text: serverMsg,
                icon: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Picture file selector
    const handlePictureSelected = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype || file.type)) {
            Swal.fire({ title: 'Invalid Image Format', text: 'Please choose a JPG, PNG, or WebP picture.', icon: 'warning' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({ title: 'File Too Large', text: 'Profile picture must be smaller than 5MB.', icon: 'warning' });
            return;
        }
        setProfilePictureFile(file);
        setProfilePicturePreview(URL.createObjectURL(file));
    };

    // Soft deactivation / reactivation confirmation
    const handleAccountToggle = async (user) => {
        const willDeactivate = user.isActive !== false;

        if (willDeactivate) {
            const result = await Swal.fire({
                title: `Deactivate ${user.name}'s Account?`,
                html: `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #475569;">
                        <p style="margin-bottom: 12px;">
                            Are you sure you want to deactivate the account for <strong>${user.name}</strong> (${user.employeeId || user.email})?
                        </p>
                        <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #334155; margin-bottom: 8px;">
                            <strong>What happens upon deactivation:</strong>
                            <ul style="margin: 6px 0 0 16px; padding: 0;">
                                <li>The user will be blocked from logging into the portal.</li>
                                <li>The user cannot be assigned new tasks or projects.</li>
                                <li><strong>All historical records (tasks, attendance, leave logs) are preserved 100% intact.</strong></li>
                                <li>You can reactivate this account at any time with one click.</li>
                            </ul>
                        </div>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d97706',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, Deactivate Account',
                cancelButtonText: 'Cancel',
                focusCancel: true
            });

            if (!result.isConfirmed) return;

            try {
                await axios.put(`/users/${user._id}`, { isActive: false });
                await loadUsers();
                Swal.fire({
                    title: 'Account Deactivated',
                    text: `${user.name}'s account has been deactivated. Historical records remain fully preserved.`,
                    icon: 'success',
                    timer: 2500,
                    showConfirmButton: false
                });
            } catch (err) {
                Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not update account.', icon: 'error' });
            }
        } else {
            const result = await Swal.fire({
                title: `Reactivate ${user.name}'s Account?`,
                text: `${user.name} will be able to log in and receive task assignments again.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Yes, Reactivate Account',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            try {
                await axios.put(`/users/${user._id}`, { isActive: true, isSuspended: false });
                await loadUsers();
                Swal.fire({
                    title: 'Account Reactivated!',
                    text: `${user.name}'s account is active again.`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (err) {
                Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not reactivate account.', icon: 'error' });
            }
        }
    };

    // Resend credentials
    const handleResendCredentials = async (user) => {
        const confirm = await Swal.fire({
            title: 'Resend Credentials?',
            text: `Generate a new temporary password and email sign-in instructions to ${user.email}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Email Credentials',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#3b82f6'
        });

        if (!confirm.isConfirmed) return;

        try {
            await axios.post(`/users/${user._id}/resend-credentials`);
            await loadUsers();
            Swal.fire({
                title: 'Credentials Emailed',
                text: `New login credentials were successfully dispatched to ${user.email}.`,
                icon: 'success'
            });
        } catch (err) {
            Swal.fire({
                title: 'Email Delivery Issue',
                text: err.response?.data?.message || 'Could not send email. Check SMTP settings.',
                icon: 'warning'
            });
        }
    };

    // View profile modal
    const openProfile = async (user) => {
        try {
            const response = await axios.get(`/users/${user._id}/profile`);
            let pictureUrl = '';
            if (response.data.user.profilePicture) {
                const image = await axios.get(`/users/${user._id}/profile-picture`, { responseType: 'blob' });
                pictureUrl = URL.createObjectURL(image.data);
            }
            setSelectedProfile({ ...response.data, pictureUrl });
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Could not load profile details', icon: 'error' });
        }
    };

    // Delete user
    const handleDelete = async (user) => {
        const result = await Swal.fire({
            title: `Delete ${user.name}?`,
            html: `
                <p style="font-size: 14px; color: #475569;">
                    Are you sure you want to remove <strong>${user.name}</strong>?
                    <br/><br/>
                    <em style="color: #64748b; font-size: 13px;">Note: By default, this softly deactivates the account to preserve audit records. Permanent removal can only occur if no tasks or attendance are linked.</em>
                </p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Remove Account',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#b91c1c'
        });

        if (!result.isConfirmed) return;

        try {
            await axios.delete(`/users/${user._id}`);
            await loadUsers();
            Swal.fire({ title: 'Updated', text: 'Account status updated.', icon: 'success', timer: 2000, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Error processing delete', icon: 'error' });
        }
    };

    // Excel Export
    const exportDirectory = () => {
        const currentList = activeDirectoryTab === 'managers' ? filteredManagers : filteredEmployees;
        const rows = currentList.map((u) => {
            const base = {
                'Full Name': u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                'Role': u.role,
                'Profile ID': u.employeeId || '',
                'Email': u.email,
                'Phone': u.phone || '',
                'Department': u.department || '',
                'Designation': u.designation || '',
                'Employment Type': u.employmentType || 'Full-time',
                'Employment Status': u.employmentStatus || 'Active',
                'Joining Date': u.joiningDate ? new Date(u.joiningDate).toLocaleDateString() : '',
                'Account Status': u.isSuspended ? 'Suspended' : u.isActive === false ? 'Deactivated' : 'Active',
            };
            if (activeDirectoryTab === 'managers') {
                base['Assigned Teams'] = Array.isArray(u.teams) ? u.teams.join(', ') : '';
                base['Reporting Employees Count'] = u.totalReportingEmployees || 0;
            } else {
                base['Team'] = u.team || '';
                base['Reporting Manager'] = u.manager?.name || 'Unassigned';
            }
            return base;
        });

        const workbook = XLSX.utils.book_new();
        const sheetName = activeDirectoryTab === 'managers' ? 'Managers' : 'Employees';
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
        XLSX.writeFile(workbook, `taskflow-${sheetName.toLowerCase()}-directory.xlsx`);
    };

    // Bulk Import for Employees
    const handleBulkImport = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setImporting(true);
        try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const importedUsers = rows.map((row) => {
                const values = Object.fromEntries(
                    Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[\s_-]/g, ''), v])
                );
                const managerValue = String(values.reportingmanager || values.manager || '').trim().toLowerCase();
                const manager = users.find((m) => m.email?.toLowerCase() === managerValue || m.name?.toLowerCase() === managerValue);
                const date = values.joiningdate instanceof Date ? values.joiningdate.toISOString().slice(0, 10) : values.joiningdate;
                return {
                    firstName: values.firstname || '',
                    lastName: values.lastname || '',
                    name: values.name || '',
                    email: String(values.email || '').trim(),
                    phone: values.phone || '',
                    employeeId: values.employeeid || '',
                    designation: values.designation || '',
                    department: values.department || 'General',
                    team: values.team || '',
                    joiningDate: date || null,
                    manager: manager?._id || '',
                    role: values.role === 'Manager' ? 'Manager' : 'Employee',
                    employmentType: values.employmenttype || 'Full-time',
                    employmentStatus: values.employmentstatus || 'Active',
                };
            });

            const result = await axios.post('/users/import', { users: importedUsers });
            await loadUsers();
            Swal.fire({
                title: 'Import Completed',
                text: `${result.data.created?.length || 0} accounts successfully created.`,
                icon: 'success'
            });
        } catch (err) {
            Swal.fire({ title: 'Import Failed', text: err.response?.data?.message || 'Check spreadsheet structure.', icon: 'error' });
        } finally {
            setImporting(false);
        }
    };

    // Filtered lists for Employees vs Managers
    const normalizedSearch = search.trim().toLowerCase();

    const matchesSearch = useCallback((user) => {
        if (!normalizedSearch) return true;
        const pool = [
            user.name,
            user.firstName,
            user.lastName,
            user.email,
            user.employeeId,
            user.designation,
            user.department,
            user.team
        ];
        return pool.some((v) => String(v || '').toLowerCase().includes(normalizedSearch));
    }, [normalizedSearch]);

    const matchesFilters = useCallback((user) => {
        const userStatus = user.isSuspended ? 'suspended' : user.isActive === false ? 'deactivated' : 'active';
        return (
            (!filters.department || user.department === filters.department) &&
            (!filters.team || user.team === filters.team || (Array.isArray(user.teams) && user.teams.includes(filters.team))) &&
            (!filters.status || userStatus === filters.status) &&
            (!filters.employmentType || user.employmentType === filters.employmentType)
        );
    }, [filters]);

    const employeesList = useMemo(() => {
        return users.filter((u) => u.role === 'Employee');
    }, [users]);

    const managersList = useMemo(() => {
        return users.filter((u) => u.role === 'Manager');
    }, [users]);

    const filteredEmployees = useMemo(() => {
        return employeesList.filter((u) => matchesSearch(u) && matchesFilters(u));
    }, [employeesList, matchesSearch, matchesFilters]);

    const filteredManagers = useMemo(() => {
        return managersList.filter((u) => matchesSearch(u) && matchesFilters(u));
    }, [managersList, matchesSearch, matchesFilters]);

    // Active dataset based on subtab
    const currentList = activeDirectoryTab === 'managers' ? filteredManagers : filteredEmployees;

    // Sorting
    const sortedList = useMemo(() => {
        return [...currentList].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (sortField === 'name') {
                valA = a.name || a.firstName || '';
                valB = b.name || b.firstName || '';
            }
            if (typeof valA === 'string') {
                const comparison = valA.localeCompare(valB || '');
                return sortDirection === 'asc' ? comparison : -comparison;
            }
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            return 0;
        });
    }, [currentList, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(sortedList.length / itemsPerPage) || 1;
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedList.slice(start, start + itemsPerPage);
    }, [sortedList, currentPage]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Dependent list of eligible managers for selected department in form
    const eligibleFormManagers = useMemo(() => {
        return users.filter((u) => {
            if (u.role !== 'Manager') return false;
            if (u.isActive === false || u.isSuspended) return false;
            if (editingUser && u._id === editingUser._id) return false;
            return true;
        });
    }, [users, editingUser]);

    // Available teams for currently selected department in form
    const currentDeptTeams = useMemo(() => {
        const deptDoc = departments.find((d) => d.name === formData.department);
        return deptDoc?.teams || [];
    }, [departments, formData.department]);

    return (
        <div className="dashboard-page employee-manager-page">
            {/* TOP BAR / HEADER */}
            <div className="dashboard-header employee-directory-header no-print">
                <div className="directory-header-title-wrap">
                    <div className="directory-badge">Organization Workforce</div>
                    <h2>Workforce &amp; Account Governance</h2>
                    <p className="muted-text">
                        Admin authority to provision, structure, and supervise Employee and Manager accounts.
                    </p>
                </div>

                <div className="employee-directory-actions">
                    <input
                        ref={importInputRef}
                        className="visually-hidden"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleBulkImport}
                    />
                    <button
                        type="button"
                        className="btn-ghost btn-small"
                        onClick={() => importInputRef.current?.click()}
                        disabled={importing}
                        title="Bulk import employee roster via Excel/CSV"
                    >
                        <FileUp size={15} />
                        {importing ? 'Importing...' : 'Import'}
                    </button>

                    <button
                        type="button"
                        className="btn-ghost btn-small"
                        onClick={exportDirectory}
                        title="Export current directory view to Excel"
                    >
                        <Download size={15} />
                        Export Excel
                    </button>

                    <button
                        type="button"
                        className="btn-ghost btn-small"
                        onClick={() => window.print()}
                        title="Print or save as PDF"
                    >
                        <Printer size={15} />
                        PDF / Print
                    </button>

                    {/* TWO DISTINCT CREATION BUTTONS */}
                    <button
                        type="button"
                        className="btn-primary btn-small add-employee-action-btn"
                        onClick={() => handleOpenCreateForm('Employee')}
                    >
                        <UserPlus size={16} />
                        + Add Employee
                    </button>

                    <button
                        type="button"
                        className="btn-primary btn-small add-manager-action-btn"
                        onClick={() => handleOpenCreateForm('Manager')}
                    >
                        <ShieldCheck size={16} />
                        + Add Manager
                    </button>
                </div>
            </div>

            {/* DIRECTORY SUBTABS */}
            <div className="directory-subtabs-bar no-print">
                <button
                    type="button"
                    className={`directory-subtab-btn ${activeDirectoryTab === 'employees' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveDirectoryTab('employees');
                        setCurrentPage(1);
                    }}
                >
                    <UserRound size={17} className="subtab-icon" />
                    <span className="subtab-title">Employees Directory</span>
                    <span className="subtab-counter">{employeesList.length}</span>
                </button>

                <button
                    type="button"
                    className={`directory-subtab-btn ${activeDirectoryTab === 'managers' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveDirectoryTab('managers');
                        setCurrentPage(1);
                    }}
                >
                    <Users size={17} className="subtab-icon" />
                    <span className="subtab-title">Managers Directory</span>
                    <span className="subtab-counter">{managersList.length}</span>
                </button>
            </div>

            {/* SEARCH AND FILTERS TOOLBAR */}
            <section className="employee-directory-tools no-print">
                <label className="employee-search">
                    <Search size={16} />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder={`Search ${activeDirectoryTab} by name, ID, email, or role...`}
                    />
                </label>

                {/* Department filter */}
                <select
                    value={filters.department}
                    onChange={(e) => {
                        setFilters({ ...filters, department: e.target.value });
                        setCurrentPage(1);
                    }}
                    aria-label="Filter by department"
                >
                    <option value="">All Departments</option>
                    {[...new Set([...departments.map((d) => d.name), 'General'])].filter(Boolean).map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>

                {/* Team filter */}
                <select
                    value={filters.team}
                    onChange={(e) => {
                        setFilters({ ...filters, team: e.target.value });
                        setCurrentPage(1);
                    }}
                    aria-label="Filter by team"
                >
                    <option value="">All Teams</option>
                    {[...new Set(users.flatMap((u) => [u.team, ...(Array.isArray(u.teams) ? u.teams : [])]).filter(Boolean))].map((tm) => (
                        <option key={tm} value={tm}>{tm}</option>
                    ))}
                </select>

                {/* Employment Type filter */}
                <select
                    value={filters.employmentType}
                    onChange={(e) => {
                        setFilters({ ...filters, employmentType: e.target.value });
                        setCurrentPage(1);
                    }}
                    aria-label="Filter by employment type"
                >
                    <option value="">All Employment Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                </select>

                {/* Status filter */}
                <select
                    value={filters.status}
                    onChange={(e) => {
                        setFilters({ ...filters, status: e.target.value });
                        setCurrentPage(1);
                    }}
                    aria-label="Filter by account status"
                >
                    <option value="">All Account Statuses</option>
                    <option value="active">Active</option>
                    <option value="deactivated">Deactivated</option>
                    <option value="suspended">Suspended</option>
                </select>

                {(search || filters.department || filters.team || filters.status || filters.employmentType) && (
                    <button
                        type="button"
                        className="btn-ghost btn-small reset-filters-btn"
                        onClick={() => {
                            setSearch('');
                            setFilters({ department: '', team: '', status: '', employmentType: '' });
                            setCurrentPage(1);
                        }}
                    >
                        <RefreshCw size={13} />
                        Reset
                    </button>
                )}

                <span className="employee-result-count">
                    Showing {paginatedList.length} of {currentList.length} {activeDirectoryTab}
                </span>
            </section>

            {error && <p className="error-text no-print">{error}</p>}

            {/* DIRECTORY TABLES */}
            <div className="employee-directory-table-wrap" id="employee-print-directory">
                <div className="employee-print-heading">
                    <h1>Taskflow {activeDirectoryTab === 'managers' ? 'Managers' : 'Employees'} Directory</h1>
                    <p>Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {activeDirectoryTab === 'employees' ? (
                    /* EMPLOYEES TABLE */
                    <table className="employee-directory-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Employee</span>
                                        <ArrowUpDown size={13} />
                                    </div>
                                </th>
                                <th onClick={() => handleSort('employeeId')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Employee ID</span>
                                        <ArrowUpDown size={13} />
                                    </div>
                                </th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th>Team</th>
                                <th>Reporting Manager</th>
                                <th>Joining Date</th>
                                <th>Status</th>
                                <th className="no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedList.map((emp) => {
                                const isDeactivated = emp.isActive === false;
                                return (
                                    <tr key={emp._id} className={isDeactivated ? 'deactivated-row' : ''}>
                                        <td>
                                            <div className="employee-table-person">
                                                <EmployeeAvatar employee={emp} />
                                                <div className="person-details">
                                                    <strong>{emp.name}</strong>
                                                    <small>{emp.email}</small>
                                                    {emp.phone && <small className="phone-line"><Phone size={11} /> {emp.phone}</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="id-badge employee-id-badge">
                                                {emp.employeeId || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="department-tag">{emp.department || 'General'}</span>
                                        </td>
                                        <td>{emp.designation || 'Employee'}</td>
                                        <td>
                                            <span className="team-pill">{emp.team || 'General Team'}</span>
                                        </td>
                                        <td>
                                            {emp.manager ? (
                                                <div className="manager-cell-info">
                                                    <strong>{emp.manager.name}</strong>
                                                    <small>{emp.manager.email}</small>
                                                </div>
                                            ) : (
                                                <span className="unassigned-badge">Unassigned</span>
                                            )}
                                        </td>
                                        <td>
                                            {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td>
                                            <span className={`employee-status ${emp.isSuspended ? 'suspended' : isDeactivated ? 'inactive' : 'active'}`}>
                                                <span className="status-dot"></span>
                                                {emp.isSuspended ? 'Suspended' : isDeactivated ? 'Deactivated' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="employee-actions-cell no-print">
                                            <button
                                                type="button"
                                                className="action-icon-btn"
                                                title="View Full Profile & Analytics"
                                                onClick={() => openProfile(emp)}
                                            >
                                                <Eye size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn"
                                                title="Edit Profile"
                                                onClick={() => handleOpenEditForm(emp)}
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`action-toggle-btn ${isDeactivated ? 'activate' : 'deactivate'}`}
                                                title={isDeactivated ? 'Reactivate Account' : 'Deactivate Account'}
                                                onClick={() => handleAccountToggle(emp)}
                                            >
                                                {isDeactivated ? 'Reactivate' : 'Deactivate'}
                                            </button>
                                            {!emp.credentialsSent && (
                                                <button
                                                    type="button"
                                                    className="action-icon-btn highlight-mail"
                                                    title="Resend Sign-in Credentials"
                                                    onClick={() => handleResendCredentials(emp)}
                                                >
                                                    <Mail size={15} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="action-icon-btn danger"
                                                title="Delete Record"
                                                onClick={() => handleDelete(emp)}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedList.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="employee-empty-row">
                                        {loading ? 'Loading directory records...' : 'No employees match the applied search and filter criteria.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    /* MANAGERS TABLE */
                    <table className="employee-directory-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Manager</span>
                                        <ArrowUpDown size={13} />
                                    </div>
                                </th>
                                <th onClick={() => handleSort('employeeId')} className="sortable-th">
                                    <div className="th-content">
                                        <span>Manager ID</span>
                                        <ArrowUpDown size={13} />
                                    </div>
                                </th>
                                <th>Department</th>
                                <th>Designation</th>
                                <th>Assigned Teams</th>
                                <th>Reporting Employees</th>
                                <th>Joining Date</th>
                                <th>Status</th>
                                <th className="no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedList.map((mgr) => {
                                const isDeactivated = mgr.isActive === false;
                                const reportCount = mgr.totalReportingEmployees || 0;
                                return (
                                    <tr key={mgr._id} className={isDeactivated ? 'deactivated-row' : ''}>
                                        <td>
                                            <div className="employee-table-person">
                                                <EmployeeAvatar employee={mgr} />
                                                <div className="person-details">
                                                    <strong>{mgr.name}</strong>
                                                    <small>{mgr.email}</small>
                                                    {mgr.phone && <small className="phone-line"><Phone size={11} /> {mgr.phone}</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="id-badge manager-id-badge">
                                                {mgr.employeeId || '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="department-tag">{mgr.department || 'General'}</span>
                                        </td>
                                        <td>{mgr.designation || 'Manager'}</td>
                                        <td>
                                            <div className="teams-badge-group">
                                                {Array.isArray(mgr.teams) && mgr.teams.length > 0 ? (
                                                    mgr.teams.map((t) => <span key={t} className="team-pill">{t}</span>)
                                                ) : mgr.team ? (
                                                    <span className="team-pill">{mgr.team}</span>
                                                ) : (
                                                    <span className="muted-text small">All Department Teams</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="reports-count-pill"
                                                onClick={() => setViewingManager(mgr)}
                                                title="View Manager's Direct Reports and Assigned Tasks"
                                            >
                                                <Users size={13} />
                                                <span>{reportCount} Direct {reportCount === 1 ? 'Report' : 'Reports'}</span>
                                            </button>
                                        </td>
                                        <td>
                                            {mgr.joiningDate ? new Date(mgr.joiningDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td>
                                            <span className={`employee-status ${mgr.isSuspended ? 'suspended' : isDeactivated ? 'inactive' : 'active'}`}>
                                                <span className="status-dot"></span>
                                                {mgr.isSuspended ? 'Suspended' : isDeactivated ? 'Deactivated' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="employee-actions-cell no-print">
                                            <button
                                                type="button"
                                                className="action-icon-btn"
                                                title="View Team Overview & Tasks"
                                                onClick={() => setViewingManager(mgr)}
                                            >
                                                <Users size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn"
                                                title="View Profile Details"
                                                onClick={() => openProfile(mgr)}
                                            >
                                                <Eye size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn"
                                                title="Edit Profile"
                                                onClick={() => handleOpenEditForm(mgr)}
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className={`action-toggle-btn ${isDeactivated ? 'activate' : 'deactivate'}`}
                                                title={isDeactivated ? 'Reactivate Account' : 'Deactivate Account'}
                                                onClick={() => handleAccountToggle(mgr)}
                                            >
                                                {isDeactivated ? 'Reactivate' : 'Deactivate'}
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn highlight-mail"
                                                title="Resend Sign-in Credentials"
                                                onClick={() => handleResendCredentials(mgr)}
                                            >
                                                <Mail size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                className="action-icon-btn danger"
                                                title="Delete Record"
                                                onClick={() => handleDelete(mgr)}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {paginatedList.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="employee-empty-row">
                                        {loading ? 'Loading manager records...' : 'No managers match the applied search and filter criteria.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* PAGINATION BAR */}
                {totalPages > 1 && (
                    <div className="directory-pagination-bar no-print">
                        <span className="pagination-info">
                            Page {currentPage} of {totalPages} ({currentList.length} total records)
                        </span>
                        <div className="pagination-controls">
                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    className={`pagination-page-btn ${currentPage === page ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* CREATION AND EDIT MODAL */}
            {modalMode && (
                <div className="custom-modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalMode(null); }}>
                    <div className="custom-modal-panel directory-account-modal" role="dialog" aria-modal="true">
                        <header className="custom-modal-header">
                            <div>
                                <h3>
                                    {modalMode === 'create-manager'
                                        ? 'Create Manager Account'
                                        : modalMode === 'create-employee'
                                        ? 'Create Employee Account'
                                        : `Edit ${formData.role} Profile`}
                                </h3>
                                <p className="custom-modal-subtitle">
                                    {modalMode === 'create-manager'
                                        ? 'Provision managerial authority with department supervision.'
                                        : modalMode === 'create-employee'
                                        ? 'Provision organizational employee with reporting manager assignment.'
                                        : `Update credentials, department, and role parameters for ${formData.firstName || 'user'}.`}
                                </p>
                            </div>
                            <button type="button" className="close-modal-icon-btn" onClick={() => setModalMode(null)} aria-label="Close form">
                                <X size={20} />
                            </button>
                        </header>

                        <form onSubmit={handleSubmit} className="directory-modal-form" noValidate>
                            {/* SECTION 1: PERSONAL INFORMATION */}
                            <div className="form-section-block">
                                <h4 className="section-title">
                                    <UserRound size={16} /> 1. Personal Information
                                </h4>

                                <div className="avatar-upload-row">
                                    <div className="avatar-preview-box">
                                        {profilePicturePreview ? (
                                            <img src={profilePicturePreview} alt="Preview" className="preview-img" />
                                        ) : (
                                            <div className="preview-placeholder">
                                                <Camera size={24} />
                                                <span>Photo</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="avatar-upload-meta">
                                        <label className="btn-ghost btn-small upload-photo-btn">
                                            Choose Profile Picture
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="visually-hidden"
                                                onChange={handlePictureSelected}
                                            />
                                        </label>
                                        <small className="muted-text">JPG, PNG, or WebP. Max 5MB.</small>
                                        {profilePictureFile && (
                                            <span className="file-selected-tag">
                                                Selected: {profilePictureFile.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>
                                            {formData.role === 'Manager' ? 'Manager ID' : 'Employee ID'} *
                                            <button
                                                type="button"
                                                className="inline-generate-btn"
                                                onClick={() => setFormData({ ...formData, employeeId: generateUniqueId(formData.role) })}
                                            >
                                                Auto-Generate
                                            </button>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.employeeId}
                                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.toUpperCase() })}
                                            placeholder={formData.role === 'Manager' ? 'MGR-1001' : 'EMP-1001'}
                                            className={formErrors.employeeId ? 'input-error' : ''}
                                            required
                                        />
                                        {formErrors.employeeId && <span className="field-error-msg">{formErrors.employeeId}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Date of Birth</label>
                                        <input
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                                            max={new Date().toISOString().slice(0, 10)}
                                        />
                                    </div>
                                </div>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>First Name *</label>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            placeholder="e.g. Sarah"
                                            className={formErrors.firstName ? 'input-error' : ''}
                                            required
                                        />
                                        {formErrors.firstName && <span className="field-error-msg">{formErrors.firstName}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            placeholder="e.g. Jenkins"
                                            className={formErrors.lastName ? 'input-error' : ''}
                                        />
                                        {formErrors.lastName && <span className="field-error-msg">{formErrors.lastName}</span>}
                                    </div>
                                </div>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>Official Email Address *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="sarah.jenkins@company.com"
                                            className={formErrors.email ? 'input-error' : ''}
                                            required
                                        />
                                        {formErrors.email && <span className="field-error-msg">{formErrors.email}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Contact Phone Number *</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+1 (555) 019-2834"
                                            className={formErrors.phone ? 'input-error' : ''}
                                            required
                                        />
                                        {formErrors.phone && <span className="field-error-msg">{formErrors.phone}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: PROFESSIONAL & ORGANIZATIONAL HIERARCHY */}
                            <div className="form-section-block">
                                <h4 className="section-title">
                                    <Briefcase size={16} /> 2. Professional Details &amp; Hierarchy
                                </h4>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>Department *</label>
                                        <select
                                            value={formData.department}
                                            onChange={(e) => handleDepartmentChange(e.target.value)}
                                            className={formErrors.department ? 'input-error' : ''}
                                            required
                                        >
                                            <option value="">Select Department</option>
                                            {[...new Set([...departments.map((d) => d.name), 'General'])].filter(Boolean).map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                        {formErrors.department && <span className="field-error-msg">{formErrors.department}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Designation / Job Title *</label>
                                        <input
                                            type="text"
                                            value={formData.designation}
                                            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                            placeholder={formData.role === 'Manager' ? 'e.g. Engineering Lead / Head' : 'e.g. Senior Frontend Engineer'}
                                            required
                                        />
                                    </div>
                                </div>

                                {formData.role === 'Employee' ? (
                                    /* EMPLOYEE SPECIFIC: SINGLE TEAM & REPORTING MANAGER */
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label>Team (within {formData.department || 'Department'})</label>
                                            {currentDeptTeams.length > 0 ? (
                                                <select
                                                    value={formData.team}
                                                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                                >
                                                    <option value="">General / Unassigned Team</option>
                                                    {currentDeptTeams.map((t) => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={formData.team}
                                                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                                    placeholder="e.g. Operations, Support"
                                                />
                                            )}
                                            <small className="muted-text">Teams are dynamically configured under the chosen department.</small>
                                        </div>

                                        <div className="form-group">
                                            <label>Reporting Manager</label>
                                            <select
                                                value={formData.manager}
                                                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                                            >
                                                <option value="">Unassigned (Reports to Admin)</option>
                                                {eligibleFormManagers.map((mgr) => (
                                                    <option key={mgr._id} value={mgr._id}>
                                                        {mgr.name} ({mgr.department || 'General'}) — {mgr.email}
                                                    </option>
                                                ))}
                                            </select>
                                            <small className="muted-text">Only active managers are eligible as reporting authorities.</small>
                                        </div>
                                    </div>
                                ) : (
                                    /* MANAGER SPECIFIC: MULTI-TEAM ASSIGNMENT & REPORTING LINE NOTE */
                                    <div>
                                        <div className="form-group">
                                            <label>Assigned Teams Oversight</label>
                                            {currentDeptTeams.length > 0 ? (
                                                <div className="team-checkbox-chips">
                                                    {currentDeptTeams.map((tm) => {
                                                        const isChecked = formData.teams.includes(tm);
                                                        return (
                                                            <button
                                                                key={tm}
                                                                type="button"
                                                                className={`team-chip-toggle ${isChecked ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        teams: isChecked
                                                                            ? prev.teams.filter((t) => t !== tm)
                                                                            : [...prev.teams, tm]
                                                                    }));
                                                                }}
                                                            >
                                                                {isChecked ? <CheckCircle2 size={14} /> : null}
                                                                <span>{tm}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={formData.team}
                                                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                                    placeholder="e.g. Cross-functional, Core Operations"
                                                />
                                            )}
                                        </div>

                                        <div className="manager-reporting-callout">
                                            <ShieldCheck size={18} />
                                            <span>
                                                <strong>Hierarchical Reporting Rule:</strong> Managers report directly to Organization Administration. Leave requests and scope changes are reviewed by Admin.
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="form-grid-3">
                                    <div className="form-group">
                                        <label>Joining Date *</label>
                                        <input
                                            type="date"
                                            value={formData.joiningDate}
                                            onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Employment Type</label>
                                        <select
                                            value={formData.employmentType}
                                            onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Intern">Intern</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Employment Status</label>
                                        <select
                                            value={formData.employmentStatus}
                                            onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="On Probation">On Probation</option>
                                            <option value="Notice Period">Notice Period</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: ACCOUNT CREDENTIALS & SECURITY */}
                            <div className="form-section-block">
                                <h4 className="section-title">
                                    <KeyRound size={16} /> 3. Account Access &amp; Credentials Setup
                                </h4>

                                {!editingUser ? (
                                    <div className="password-mode-selector">
                                        <label className={`password-mode-card ${formData.passwordMode === 'auto' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="passwordMode"
                                                value="auto"
                                                checked={formData.passwordMode === 'auto'}
                                                onChange={() => setFormData({ ...formData, passwordMode: 'auto', password: '', confirmPassword: '' })}
                                            />
                                            <div className="card-body">
                                                <strong>⚡ Auto-Generate Secure Temporary Password</strong>
                                                <small>Generates a 12-character high-entropy password and emails login credentials directly to {formData.email || 'the user'}.</small>
                                            </div>
                                        </label>

                                        <label className={`password-mode-card ${formData.passwordMode === 'manual' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="passwordMode"
                                                value="manual"
                                                checked={formData.passwordMode === 'manual'}
                                                onChange={() => setFormData({ ...formData, passwordMode: 'manual' })}
                                            />
                                            <div className="card-body">
                                                <strong>🔑 Set Password Manually</strong>
                                                <small>Explicitly enter an initial password for this workplace account.</small>
                                            </div>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="edit-password-toggle-wrap">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.passwordMode === 'manual'}
                                                onChange={(e) => setFormData({ ...formData, passwordMode: e.target.checked ? 'manual' : 'keep' })}
                                            />
                                            <span>Reset password for this account</span>
                                        </label>
                                    </div>
                                )}

                                {formData.passwordMode === 'manual' && (
                                    <div className="form-grid-2 password-fields-box">
                                        <div className="form-group">
                                            <label>Password (min 8 chars, numbers &amp; letters) *</label>
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="••••••••••••"
                                                className={formErrors.password ? 'input-error' : ''}
                                                required
                                            />
                                            {formErrors.password && <span className="field-error-msg">{formErrors.password}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Confirm Password *</label>
                                            <input
                                                type="password"
                                                value={formData.confirmPassword}
                                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                placeholder="••••••••••••"
                                                className={formErrors.confirmPassword ? 'input-error' : ''}
                                                required
                                            />
                                            {formErrors.confirmPassword && <span className="field-error-msg">{formErrors.confirmPassword}</span>}
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Initial Account Status</label>
                                    <select
                                        value={formData.isSuspended ? 'suspended' : formData.isActive ? 'active' : 'deactivated'}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            isActive: e.target.value !== 'deactivated',
                                            isSuspended: e.target.value === 'suspended'
                                        })}
                                    >
                                        <option value="active">Active (Permitted to log in)</option>
                                        <option value="deactivated">Deactivated (Login blocked; records preserved)</option>
                                        <option value="suspended">Suspended (Access temporarily restricted)</option>
                                    </select>
                                </div>
                            </div>

                            {/* MODAL FOOTER ACTIONS */}
                            <div className="custom-modal-footer">
                                <button type="button" className="btn-ghost" onClick={() => setModalMode(null)} disabled={isSubmitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting
                                        ? 'Saving Account...'
                                        : editingUser
                                        ? 'Save Profile Changes'
                                        : `Create ${formData.role} & Dispatch Credentials`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANAGER TEAM OVERVIEW MODAL */}
            {viewingManager && (
                <div className="custom-modal-backdrop no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewingManager(null); }}>
                    <div className="custom-modal-panel team-overview-modal" role="dialog" aria-modal="true">
                        <header className="custom-modal-header">
                            <div>
                                <h3>{viewingManager.name}&apos;s Supervisory Scope</h3>
                                <p className="custom-modal-subtitle">
                                    Department: {viewingManager.department || 'General'} · ID: {viewingManager.employeeId || 'MGR'}
                                </p>
                            </div>
                            <button type="button" className="close-modal-icon-btn" onClick={() => setViewingManager(null)}>
                                <X size={20} />
                            </button>
                        </header>

                        <div className="manager-overview-grid">
                            <div className="overview-subpanel">
                                <h4>
                                    <Users size={16} /> Direct Reports ({users.filter((u) => u.manager?._id === viewingManager._id || u.manager === viewingManager._id).length})
                                </h4>
                                {users.filter((u) => u.manager?._id === viewingManager._id || u.manager === viewingManager._id).length === 0 ? (
                                    <p className="muted-text small">No employees are currently assigned to this manager.</p>
                                ) : (
                                    <ul className="reports-list">
                                        {users.filter((u) => u.manager?._id === viewingManager._id || u.manager === viewingManager._id).map((r) => (
                                            <li key={r._id} className="report-list-item">
                                                <EmployeeAvatar employee={r} size={32} />
                                                <div className="report-info">
                                                    <strong>{r.name}</strong>
                                                    <small>{r.designation || r.role} · {r.email}</small>
                                                </div>
                                                <span className={`status-badge-micro ${r.isActive === false ? 'inactive' : 'active'}`}>
                                                    {r.isActive === false ? 'Inactive' : 'Active'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="overview-subpanel">
                                <h4>
                                    <Briefcase size={16} /> Assigned Managerial Tasks
                                </h4>
                                {tasks.filter((t) => (t.user?._id || t.user) === viewingManager._id).length === 0 ? (
                                    <p className="muted-text small">No personal tasks assigned to this manager.</p>
                                ) : (
                                    <ul className="manager-tasks-list">
                                        {tasks.filter((t) => (t.user?._id || t.user) === viewingManager._id).map((t) => (
                                            <li key={t._id} className="manager-task-item">
                                                <div>
                                                    <strong>{t.title}</strong>
                                                    {t.project && <small className="project-sub">{t.project}</small>}
                                                </div>
                                                <span className={`task-badge ${t.status}`}>
                                                    {t.status}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="custom-modal-footer">
                            <button type="button" className="btn-primary btn-small" onClick={() => setViewingManager(null)}>
                                Close Overview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL PROFILE DETAIL MODAL */}
            {selectedProfile && (
                <div
                    className="employee-profile-backdrop no-print"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            if (selectedProfile.pictureUrl) URL.revokeObjectURL(selectedProfile.pictureUrl);
                            setSelectedProfile(null);
                        }
                    }}
                >
                    <section className="employee-profile-modal" role="dialog" aria-modal="true">
                        <header>
                            <div>
                                <h2>Personnel Profile &amp; Audit Summary</h2>
                                <p>Comprehensive account records, performance, attendance, and leave history</p>
                            </div>
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => {
                                    if (selectedProfile.pictureUrl) URL.revokeObjectURL(selectedProfile.pictureUrl);
                                    setSelectedProfile(null);
                                }}
                            >
                                ×
                            </button>
                        </header>

                        <div className="employee-profile-identity">
                            {selectedProfile.pictureUrl ? (
                                <img src={selectedProfile.pictureUrl} alt="" className="profile-large-img" />
                            ) : (
                                <EmployeeAvatar employee={selectedProfile.user} size={70} />
                            )}
                            <div>
                                <h3>{selectedProfile.user.name}</h3>
                                <p>{selectedProfile.user.designation || selectedProfile.user.role} · {selectedProfile.user.department || 'General'}</p>
                                <p className="id-subtext">{selectedProfile.user.employeeId || 'No Profile ID'} · {selectedProfile.user.email}</p>
                                <div className="meta-badges-row">
                                    <span className="badge-micro">{selectedProfile.user.employmentType || 'Full-time'}</span>
                                    <span className={`badge-micro ${selectedProfile.user.isActive === false ? 'danger' : 'success'}`}>
                                        {selectedProfile.user.isActive === false ? 'Deactivated' : 'Active Account'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="employee-profile-stats">
                            <div>
                                <strong>{selectedProfile.performance?.totalTasks || 0}</strong>
                                <span>Total Tasks</span>
                            </div>
                            <div>
                                <strong>{selectedProfile.performance?.completionRate || 0}%</strong>
                                <span>Completion</span>
                            </div>
                            <div>
                                <strong>{selectedProfile.performance?.focusMinutes || 0}m</strong>
                                <span>Focus Time</span>
                            </div>
                        </div>

                        <section className="profile-detail-section">
                            <h4>Tasks &amp; Project Assignments</h4>
                            {selectedProfile.tasks?.length ? (
                                <ul className="profile-item-list">
                                    {selectedProfile.tasks.map((task) => (
                                        <li key={task._id}>
                                            <span>{task.title}{task.project ? ` · ${task.project}` : ''}</span>
                                            <strong>{task.status}</strong>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="muted-text small">No assigned tasks found.</p>
                            )}
                        </section>

                        <section className="profile-detail-section">
                            <h4>Recent Attendance</h4>
                            {selectedProfile.attendance?.length ? (
                                <ul className="profile-item-list">
                                    {selectedProfile.attendance.slice(0, 5).map((rec) => (
                                        <li key={rec._id}>
                                            <span>{rec.date}</span>
                                            <span>{rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString() : 'No clock-in'}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="muted-text small">No attendance records on file.</p>
                            )}
                        </section>

                        <section className="profile-detail-section">
                            <h4>Leave History</h4>
                            {selectedProfile.leaveHistory?.length ? (
                                <ul className="profile-item-list">
                                    {selectedProfile.leaveHistory.map((l) => (
                                        <li key={l._id}>
                                            <span>{l.leaveType} ({new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()})</span>
                                            <strong className={`status-text-${l.status}`}>{l.status}</strong>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="muted-text small">No leave requests recorded.</p>
                            )}
                        </section>

                        <section className="profile-detail-section">
                            <h4>Department History</h4>
                            {selectedProfile.user.departmentHistory?.length ? (
                                <ul className="profile-item-list">
                                    {[...selectedProfile.user.departmentHistory].reverse().map((entry, index) => (
                                        <li key={`${entry.changedAt}-${index}`}>
                                            <span>{entry.fromDepartment || 'New hire'} → {entry.toDepartment}</span>
                                            <span>{new Date(entry.changedAt).toLocaleDateString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="muted-text small">No department transfers recorded.</p>
                            )}
                        </section>
                    </section>
                </div>
            )}
        </div>
    );
}

export default EmployeeManager;
