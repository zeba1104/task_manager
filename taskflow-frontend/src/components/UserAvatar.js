import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function UserAvatar({ user, className = 'emp-avatar-medium', fallbackClass = '' }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!user?._id || !user?.profilePicture) {
      setImageUrl('');
      return () => { active = false; };
    }
    axios.get(`/users/${user._id}/profile-picture?t=${encodeURIComponent(user.profilePicture)}`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        if (active) setImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setImageUrl('');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?._id, user?.profilePicture]);

  const initial = (user?.name || user?.firstName || 'U')[0].toUpperCase();

  if (imageUrl) {
    return <img className={className} src={imageUrl} alt={user?.name || 'User'} />;
  }

  return (
    <span className={fallbackClass || `${className}-fallback`}>
      {initial}
    </span>
  );
}
