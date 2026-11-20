import React, { useState, useEffect, useCallback } from 'react';
import Swal from '../utils/swalConfig';
import {
    UserRound,
    KeyRound,
    Lock,
    Phone,
    Mail,
    Briefcase,
    Building2,
    Users,
    UserCheck,
    Calendar,
    Activity,
    FileText,
    Camera,
    Trash2,
    Save,
    Eye,
    EyeOff,
    ShieldCheck,
    Send,
    CheckCircle2,
    Clock,
    XCircle,
    BadgeCheck,
    Layers
} from 'lucide-react';

// APIs
import {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword,
    uploadProfilePicture as uploadAdminPhoto,
    deleteProfilePicture as deleteAdminPhoto,
} from '../api/adminApi';

import {
    getManagerProfile,
    updateManagerProfile,
    changeManagerPassword,
    requestProfileChange as requestManagerChange,
    uploadProfilePicture as uploadManagerPhoto,
    deleteProfilePicture as deleteManagerPhoto,
} from '../api/managerApi';

import {
    getEmployeeProfile,
    updatePermittedProfile,
    changeEmployeePassword,
    requestProfileChange as requestEmployeeChange,
    uploadProfilePicture as uploadEmpPhoto,
    deleteProfilePicture as deleteEmpPhoto,
} from '../api/employeeApi';

function SettingsView({ user, onUserUpdated }) {
    const role = user?.role || 'Employee';

    // State
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState(null);
    const [savingDetails, setSavingDetails] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [submittingChange, setSubmittingChange] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Personal Details Form
    const [personalForm, setPersonalForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
    });

    // Password Form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Restricted Change Request Form (for Employee & Manager)
    const [changeForm, setChangeForm] = useState({
        field: 'email',
        requestedValue: '',
        reason: '',
    });

    // Load Profile depending on role
    const loadProfile = useCallback(async () => {
        try {
            setLoading(true);
            let data = null;
            if (role === 'Admin') {
                const res = await getAdminProfile();
                data = res.data;
            } else if (role === 'Manager') {
                const res = await getManagerProfile();
                data = res.data;
            } else {
                const res = await getEmployeeProfile();
                data = res.data;
            }

            setProfileData(data);
            const targetUser = data?.user || data?.manager || user;
            const nameParts = String(targetUser?.name || '').trim().split(/\s+/);
            setPersonalForm({
                firstName: targetUser?.firstName || nameParts[0] || '',
                lastName: targetUser?.lastName || nameParts.slice(1).join(' ') || '',
                phone: targetUser?.phone || '',
            });
        } catch (err) {
            console.error('Failed to load settings profile:', err);
            // Fallback to user prop
            if (user) {
                const nameParts = String(user.name || '').trim().split(/\s+/);
                setPersonalForm({
                    firstName: user.firstName || nameParts[0] || '',
                    lastName: user.lastName || nameParts.slice(1).join(' ') || '',
                    phone: user.phone || '',
                });
            }
        } finally {
            setLoading(false);
        }
    }, [role, user]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const activeUser = profileData?.user || profileData?.manager || user;

    // Handle Photo Upload
    const handlePhotoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            Swal.fire({ title: 'Invalid Image', text: 'Please choose a JPG, PNG, or WebP picture.', icon: 'warning' });
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({ title: 'File Too Large', text: 'Profile picture must be smaller than 5MB.', icon: 'warning' });
            return;
        }

        const targetId = activeUser?._id;
        if (!targetId) return;

        setUploadingPhoto(true);
        const uploadData = new FormData();
        uploadData.append('picture', file);

        try {
            let res;
            if (role === 'Admin') res = await uploadAdminPhoto(targetId, uploadData);
            else if (role === 'Manager') res = await uploadManagerPhoto(targetId, uploadData);
            else res = await uploadEmpPhoto(targetId, uploadData);

            const newPic = res.data?.profilePicture;
            onUserUpdated?.({ profilePicture: newPic });
            await loadProfile();

            Swal.fire({
                title: 'Photo Updated',
                text: 'Your new profile photo was uploaded successfully.',
                icon: 'success',
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire({
                title: 'Upload Failed',
                text: err.response?.data?.message || 'Could not upload profile picture.',
                icon: 'error',
            });
        } finally {
            setUploadingPhoto(false);
            event.target.value = '';
        }
    };

    // Handle Photo Removal
    const handlePhotoRemove = async () => {
        const targetId = activeUser?._id;
        if (!targetId) return;

        const confirm = await Swal.fire({
            title: 'Remove Profile Picture?',
            text: 'Your initials will be displayed instead.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove photo',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ef4444',
        });

        if (!confirm.isConfirmed) return;

        setUploadingPhoto(true);
        try {
            if (role === 'Admin') await deleteAdminPhoto(targetId);
            else if (role === 'Manager') await deleteManagerPhoto(targetId);
            else await deleteEmpPhoto(targetId);

            onUserUpdated?.({ profilePicture: null });
            await loadProfile();

            Swal.fire({
                title: 'Photo Removed',
                text: 'Your profile picture has been removed.',
                icon: 'success',
                timer: 1600,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.response?.data?.message || 'Could not remove photo.',
                icon: 'error',
            });
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Save Personal Details
    const handleSavePersonal = async (e) => {
        e.preventDefault();
        if (!personalForm.firstName.trim()) {
            Swal.fire({ title: 'Validation Error', text: 'First name is required.', icon: 'warning' });
            return;
        }

        setSavingDetails(true);
        try {
            const payload = {
                firstName: personalForm.firstName.trim(),
                lastName: personalForm.lastName.trim(),
                phone: personalForm.phone.trim(),
            };

            let updated;
            if (role === 'Admin') {
                const res = await updateAdminProfile(payload);
                updated = res.data;
            } else if (role === 'Manager') {
                const res = await updateManagerProfile(payload);
                updated = res.data;
            } else {
                const res = await updatePermittedProfile(payload);
                updated = res.data;
            }

            onUserUpdated?.(updated);
            await loadProfile();

            Swal.fire({
                title: 'Personal Details Saved',
                text: 'Your information has been updated successfully across the platform.',
                icon: 'success',
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire({
                title: 'Save Failed',
                text: err.response?.data?.message || 'Could not save personal details.',
                icon: 'error',
            });
        } finally {
            setSavingDetails(false);
        }
    };

    // Change Password
    const handleChangePassword = async (e) => {
        e.preventDefault();
        const { currentPassword, newPassword, confirmPassword } = passwordForm;

        if (!currentPassword) {
            Swal.fire({ title: 'Missing Password', text: 'Please enter your current password.', icon: 'warning' });
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            Swal.fire({ title: 'Weak Password', text: 'New password must be at least 8 characters long.', icon: 'warning' });
            return;
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            Swal.fire({ title: 'Mismatch', text: 'New password and confirmation do not match.', icon: 'warning' });
            return;
        }

        setSavingPassword(true);
        try {
            const payload = { currentPassword, newPassword };
            if (role === 'Admin') await changeAdminPassword(payload);
            else if (role === 'Manager') await changeManagerPassword(payload);
            else await changeEmployeePassword(payload);

            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            Swal.fire({
                title: 'Password Changed',
                text: 'Your account password has been updated securely.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (err) {
            Swal.fire({
                title: 'Password Change Failed',
                text: err.response?.data?.message || 'Current password was incorrect.',
                icon: 'error',
            });
        } finally {
            setSavingPassword(false);
        }
    };

    // Request Restricted Profile Change (Employee and Manager only)
    const handleSubmitChangeRequest = async (e) => {
        e.preventDefault();
        if (!changeForm.requestedValue.trim()) {
            Swal.fire({ title: 'Required Field', text: 'Please enter the requested new value.', icon: 'warning' });
            return;
        }

        setSubmittingChange(true);
        try {
            if (role === 'Manager') await requestManagerChange(changeForm);
            else await requestEmployeeChange(changeForm);

            setChangeForm({ field: 'email', requestedValue: '', reason: '' });
            await loadProfile();

            Swal.fire({
                title: 'Change Request Submitted',
                text: 'Your request has been forwarded to the Administrator for verification and approval.',
                icon: 'success',
            });
        } catch (err) {
            Swal.fire({
                title: 'Request Failed',
                text: err.response?.data?.message || 'Could not submit change request.',
                icon: 'error',
            });
        } finally {
            setSubmittingChange(false);
        }
    };

    const photoUrl = activeUser?.profilePicture
        ? `http://localhost:5000/uploads/profile-pictures/${activeUser.profilePicture}`
        : '';

    const initials = (activeUser?.name || 'User')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const changeRequests = profileData?.changeRequests || [];

    if (loading && !profileData && !activeUser) {
        return (
            <div className="settings-page-wrapper">
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    Loading account profile and settings...
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page-wrapper">
            {/* Signature Page Header */}
            <div className="page-header-row">
                <div className="page-header-info">
                    <div className="page-title-icon-box">
                        {role === 'Admin' ? (
                            <ShieldCheck size={22} />
                        ) : role === 'Manager' ? (
                            <UserCheck size={22} />
                        ) : (
                            <UserRound size={22} />
                        )}
                    </div>
                    <div>
                        <h2 className="page-main-title">Account Settings &amp; Security</h2>
                        <p className="page-subtitle">
                            Manage your personal details, credentials, and account security preferences.
                        </p>
                    </div>
                </div>
                <div className="page-header-actions">
                    <div className="header-date-badge">
                        <ShieldCheck size={14} className="text-primary" />
                        <span>
                            {role === 'Admin'
                                ? 'Administrator Authority'
                                : role === 'Manager'
                                ? 'Department Manager'
                                : 'Team Employee'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Settings Grid */}
            <div className="settings-grid-layout">
                {/* LEFT COLUMN: Identity & Organization Credentials */}
                <div className="settings-column-left">
                    <div className="settings-card profile-summary-card">
                        {/* Profile Header Block */}
                        <div className="settings-profile-header">
                            <div className="settings-avatar-container">
                                {photoUrl ? (
                                    <img src={photoUrl} alt="Avatar" className="settings-avatar-img" />
                                ) : (
                                    <div className="settings-avatar-fallback">{initials}</div>
                                )}
                                <label className="settings-avatar-upload-badge" title="Change photo">
                                    <Camera size={15} color="#ffffff" strokeWidth={2.2} />
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="visually-hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={uploadingPhoto}
                                    />
                                </label>
                            </div>

                            <div className="settings-profile-info">
                                <h2 className="settings-profile-name">{activeUser?.name || 'Administrator'}</h2>
                                <p className="settings-profile-designation">
                                    {activeUser?.designation || (role === 'Admin' ? 'Organization Administrator' : 'Staff Member')}
                                    {activeUser?.department ? ` · ${activeUser.department}` : ''}
                                </p>
                                <span className={`settings-role-badge role-${role.toLowerCase()}`}>
                                    {role === 'Admin' ? 'System Administrator' : role}
                                </span>
                            </div>

                            <div className="settings-avatar-actions">
                                <label className="btn-secondary btn-small settings-photo-btn">
                                    <Camera size={14} strokeWidth={2} className="settings-photo-btn-icon" />
                                    <span>{uploadingPhoto ? 'Uploading...' : 'Change Photo'}</span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="visually-hidden"
                                        onChange={handlePhotoUpload}
                                        disabled={uploadingPhoto}
                                    />
                                </label>
                                {activeUser?.profilePicture && (
                                    <button
                                        type="button"
                                        className="btn-ghost btn-small text-danger settings-photo-btn"
                                        onClick={handlePhotoRemove}
                                        disabled={uploadingPhoto}
                                    >
                                        <Trash2 size={13} />
                                        <span>Remove</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Credential Tiles */}
                        <div className="settings-credentials-section">
                            <h4 className="settings-section-subtitle">
                                <BadgeCheck size={15} /> Organization Credentials
                            </h4>
                            <div className="settings-cred-grid">
                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <BadgeCheck size={13} /> Profile ID
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.employeeId || (role === 'Admin' ? 'ADMIN-001' : 'Not set')}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Mail size={13} /> Work Email
                                    </span>
                                    <strong className="settings-cred-tile-val text-truncate" title={activeUser?.email}>
                                        {activeUser?.email || '—'}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Phone size={13} /> Registered Phone
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.phone || 'Not set'}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Briefcase size={13} /> Designation
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.designation || (role === 'Admin' ? 'Organization Administrator' : 'Staff Member')}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Building2 size={13} /> Department
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.department || 'General'}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Users size={13} /> Assigned Team
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.team || (Array.isArray(activeUser?.teams) && activeUser.teams.join(', ')) || 'General'}
                                    </strong>
                                </div>

                                {role !== 'Admin' && (
                                    <div className="settings-cred-tile">
                                        <span className="settings-cred-tile-label">
                                            <UserCheck size={13} /> Reporting Authority
                                        </span>
                                        <strong className="settings-cred-tile-val">
                                            {activeUser?.manager?.name || profileData?.departmentHead?.name || 'Direct to Administration'}
                                        </strong>
                                    </div>
                                )}

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Calendar size={13} /> Joining Date
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.joiningDate
                                            ? new Date(activeUser.joiningDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                            : 'Not recorded'}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Activity size={13} /> Employment Status
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        <span className="status-dot-active"></span>
                                        {activeUser?.employmentStatus || (activeUser?.isActive !== false ? 'Active' : 'Deactivated')}
                                    </strong>
                                </div>

                                <div className="settings-cred-tile">
                                    <span className="settings-cred-tile-label">
                                        <Layers size={13} /> Employment Type
                                    </span>
                                    <strong className="settings-cred-tile-val">
                                        {activeUser?.employmentType || 'Full-time'}
                                    </strong>
                                </div>
                            </div>

                            {activeUser?.responsibilities && (
                                <div className="settings-responsibilities-block">
                                    <span className="settings-cred-tile-label">
                                        <FileText size={13} /> Assigned Responsibilities
                                    </span>
                                    <p className="settings-responsibilities-text">{activeUser.responsibilities}</p>
                                </div>
                            )}

                            {/* Team Colleagues (Employee View) */}
                            {role === 'Employee' && profileData?.teamMembers?.length > 0 && (
                                <div className="settings-team-colleagues">
                                    <h4 className="settings-section-subtitle">
                                        <Users size={15} /> Team Colleagues ({profileData.teamMembers.length})
                                    </h4>
                                    <div className="settings-colleagues-list">
                                        {profileData.teamMembers.map((member) => (
                                            <div key={member._id} className="settings-colleague-pill">
                                                <div className="colleague-mini-avatar">
                                                    {(member.name || 'M')[0].toUpperCase()}
                                                </div>
                                                <div className="colleague-mini-info">
                                                    <strong>{member.name}</strong>
                                                    <small>{member.designation || 'Colleague'}</small>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Interactive Form Stack */}
                <div className="settings-column-right">
                    {/* FORM 1: Update Personal Details */}
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div>
                                <h3 className="settings-card-title">
                                    <UserRound size={17} className="text-primary" /> Personal Information
                                </h3>
                                <p className="settings-card-subtitle">
                                    Update your displayed name and contact phone number.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSavePersonal} className="settings-enterprise-form">
                            <div className="settings-form-row-2">
                                <div className="settings-field-group">
                                    <label htmlFor="settings-firstName" className="settings-field-label">
                                        First Name *
                                    </label>
                                    <div className="settings-input-wrapper">
                                        <UserRound size={16} className="settings-field-icon" />
                                        <input
                                            type="text"
                                            id="settings-firstName"
                                            value={personalForm.firstName}
                                            onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                                            placeholder="Enter first name"
                                            className="settings-input-control"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="settings-field-group">
                                    <label htmlFor="settings-lastName" className="settings-field-label">
                                        Last Name
                                    </label>
                                    <div className="settings-input-wrapper">
                                        <UserRound size={16} className="settings-field-icon" />
                                        <input
                                            type="text"
                                            id="settings-lastName"
                                            value={personalForm.lastName}
                                            onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                                            placeholder="Enter last name"
                                            className="settings-input-control"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="settings-field-group">
                                <label htmlFor="settings-phone" className="settings-field-label">
                                    Contact Phone Number
                                </label>
                                <div className="settings-input-wrapper">
                                    <Phone size={16} className="settings-field-icon" />
                                    <input
                                        type="tel"
                                        id="settings-phone"
                                        value={personalForm.phone}
                                        onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                                        placeholder="+1 (555) 019-2834"
                                        className="settings-input-control"
                                    />
                                </div>
                            </div>

                            <div className="settings-form-footer">
                                <button type="submit" className="btn-primary" disabled={savingDetails}>
                                    <Save size={15} />
                                    <span>{savingDetails ? 'Saving...' : 'Save Personal Details'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* FORM 2: Change Password */}
                    <div className="settings-card">
                        <div className="settings-card-header">
                            <div>
                                <h3 className="settings-card-title">
                                    <KeyRound size={17} className="text-primary" /> Security &amp; Password
                                </h3>
                                <p className="settings-card-subtitle">
                                    Keep your Taskflow account secure with a strong password.
                                </p>
                            </div>
                            <span className="settings-card-badge">Security</span>
                        </div>

                        <form onSubmit={handleChangePassword} className="settings-enterprise-form">
                            <div className="settings-field-group">
                                <label htmlFor="settings-currentPassword" className="settings-field-label">
                                    Current Password *
                                </label>
                                <div className="settings-input-wrapper">
                                    <KeyRound size={16} className="settings-field-icon" />
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        id="settings-currentPassword"
                                        autoComplete="current-password"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                        placeholder="Enter your current password"
                                        className="settings-input-control"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="settings-pw-toggle"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        aria-label="Toggle password visibility"
                                    >
                                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="settings-form-row-2">
                                <div className="settings-field-group">
                                    <label htmlFor="settings-newPassword" className="settings-field-label">
                                        New Password * <small>(min 8 chars)</small>
                                    </label>
                                    <div className="settings-input-wrapper">
                                        <Lock size={16} className="settings-field-icon" />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            id="settings-newPassword"
                                            autoComplete="new-password"
                                            minLength={8}
                                            value={passwordForm.newPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                            placeholder="Minimum 8 characters"
                                            className="settings-input-control"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="settings-pw-toggle"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            aria-label="Toggle password visibility"
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="settings-field-group">
                                    <label htmlFor="settings-confirmPassword" className="settings-field-label">
                                        Confirm New Password *
                                    </label>
                                    <div className="settings-input-wrapper">
                                        <Lock size={16} className="settings-field-icon" />
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            id="settings-confirmPassword"
                                            autoComplete="new-password"
                                            minLength={8}
                                            value={passwordForm.confirmPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                            placeholder="Re-enter new password"
                                            className="settings-input-control"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="settings-pw-toggle"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            aria-label="Toggle password visibility"
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-form-footer">
                                <button type="submit" className="btn-primary" disabled={savingPassword}>
                                    <KeyRound size={15} />
                                    <span>{savingPassword ? 'Updating...' : 'Change Password'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* FORM 3: Request Official Profile Change (Employee & Manager only) */}
                    {role !== 'Admin' && (
                        <div className="settings-card">
                            <div className="settings-card-header">
                                <div>
                                    <h3 className="settings-card-title">
                                        <Send size={17} className="text-primary" /> Request Official Profile Change
                                    </h3>
                                    <p className="settings-card-subtitle">
                                        Submit a formal change request for locked organizational attributes.
                                    </p>
                                </div>
                                <span className="settings-card-badge">Governance</span>
                            </div>

                            <form onSubmit={handleSubmitChangeRequest} className="settings-enterprise-form">
                                <div className="settings-form-row-2">
                                    <div className="settings-field-group">
                                        <label htmlFor="change-field" className="settings-field-label">
                                            Restricted Field *
                                        </label>
                                        <select
                                            id="change-field"
                                            value={changeForm.field}
                                            onChange={(e) => setChangeForm({ ...changeForm, field: e.target.value })}
                                            className="settings-select-control"
                                        >
                                            <option value="email">Official Work Email</option>
                                            <option value="employeeId">Profile / Employee ID</option>
                                            <option value="designation">Designation / Title</option>
                                            <option value="department">Assigned Department</option>
                                            <option value="team">Team Assignment</option>
                                            <option value="manager">Reporting Authority</option>
                                            <option value="joiningDate">Joining Date</option>
                                        </select>
                                    </div>

                                    <div className="settings-field-group">
                                        <label htmlFor="change-val" className="settings-field-label">
                                            Requested New Value *
                                        </label>
                                        <div className="settings-input-wrapper">
                                            <input
                                                type={changeForm.field === 'joiningDate' ? 'date' : 'text'}
                                                id="change-val"
                                                value={changeForm.requestedValue}
                                                onChange={(e) => setChangeForm({ ...changeForm, requestedValue: e.target.value })}
                                                placeholder="Enter new value"
                                                className="settings-input-control"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-field-group">
                                    <label htmlFor="change-reason" className="settings-field-label">
                                        Reason / Business Justification
                                    </label>
                                    <textarea
                                        id="change-reason"
                                        rows={2}
                                        value={changeForm.reason}
                                        onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
                                        placeholder="Explain the reason for this adjustment..."
                                        className="settings-textarea-control"
                                    />
                                </div>

                                <div className="settings-form-footer">
                                    <button type="submit" className="btn-secondary" disabled={submittingChange}>
                                        <Send size={14} />
                                        <span>{submittingChange ? 'Sending...' : 'Send Request to Admin'}</span>
                                    </button>
                                </div>
                            </form>

                            {/* Past Change Requests */}
                            {changeRequests.length > 0 && (
                                <div className="settings-past-requests">
                                    <h4 className="settings-section-subtitle">
                                        <Clock size={14} /> Request History ({changeRequests.length})
                                    </h4>
                                    <div className="settings-requests-table-wrap">
                                        <table className="settings-requests-table">
                                            <thead>
                                                <tr>
                                                    <th>Attribute</th>
                                                    <th>Current</th>
                                                    <th>Requested</th>
                                                    <th>Submitted</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {changeRequests.map((req) => (
                                                    <tr key={req._id}>
                                                        <td className="font-semibold text-capitalize">{req.field}</td>
                                                        <td className="text-muted">{req.currentValue || '—'}</td>
                                                        <td><strong>{req.requestedValue}</strong></td>
                                                        <td className="text-muted">
                                                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '—'}
                                                        </td>
                                                        <td>
                                                            <span className={`request-status-pill status-${req.status}`}>
                                                                {req.status === 'approved' ? (
                                                                    <><CheckCircle2 size={12} /> Approved</>
                                                                ) : req.status === 'rejected' ? (
                                                                    <><XCircle size={12} /> Rejected</>
                                                                ) : (
                                                                    <><Clock size={12} /> Pending</>
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SettingsView;
