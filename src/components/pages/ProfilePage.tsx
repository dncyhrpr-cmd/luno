'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/components/ClientProviders';
import { User, Shield, Activity, CheckCircle, Lock, Monitor, DollarSign } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

// --- Reusable Card Component ---
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`luno-card ${className}`}>
        {title && <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>}
        {children}
    </div>
);

// --- Key-Value Detail Component ---
const DetailItem: React.FC<{ label: string; value: string; icon: React.ElementType, action?: React.ReactNode }> = ({ label, value, icon: Icon, action }) => (
    <div className="flex items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
        <Icon className='w-5 h-5 mt-1 mr-3 text-indigo-500 shrink-0' />
        <div className='flex flex-col flex-grow'>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">{value}</span>
        </div>
        {action && (
            <div className="ml-4">
                {action}
            </div>
        )}
    </div>
);

// --- Action Button Component ---
const ActionButton: React.FC<{ label: string; icon: React.ElementType; color: string; onClick: () => void }> = ({ label, icon: Icon, color, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold transition-colors duration-200 border ${color.includes('indigo') ? 'text-indigo-600 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/50 dark:border-indigo-900 dark:text-indigo-300' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}
    >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
    </button>
);


const ProfilePage: React.FC = () => {
    const { user, accessToken } = useAuth();
    const { addNotification } = useNotification();
    const [profileData, setProfileData] = useState<any>(null);
    const [activityLog, setActivityLog] = useState<any[]>([]);
    const [isFullLogLoaded, setIsFullLogLoaded] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

    useEffect(() => {

        const fetchProfileData = async () => {
            if (!accessToken) {
                console.error('No access token available for profile fetch');
                return;
            }
            try {
                const response = await fetch('/api/profile', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setProfileData(data);
                } else {
                    console.error('Profile fetch failed:', response.status, response.statusText);
                }
            } catch (error: any) {
                console.error('Error fetching profile data:', error);
            }
        };

        const fetchActivityLog = async () => {
            if (!accessToken) {
                console.error('No access token available for activity log fetch');
                return;
            }
            try {
                const response = await fetch('/api/activity-log', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setActivityLog(data);
                } else {
                    console.error('Activity log fetch failed:', response.status, response.statusText);
                }
            } catch (error: any) {
                console.error('Error fetching activity log:', error);
            }
        };

        fetchProfileData();
        fetchActivityLog();
    }, []);

    const fetchFullActivityLog = async () => {
        if (!accessToken) {
            console.error('No access token available for full activity log fetch');
            return;
        }
        try {
            const response = await fetch('/api/activity-log?full=true', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setActivityLog(data);
                setIsFullLogLoaded(true);
            }
        } catch (error: any) {
            console.error('Error fetching full activity log:', error);
        }
    };

    const handleChangePasswordSubmit = async (passwordData: any) => {
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(passwordData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to change password');
        }

        addNotification('Password changed successfully!', 'success');
        setIsChangePasswordModalOpen(false);
    };

    const profile = {
        name: user?.username || 'N/A',
        email: user?.email || 'N/A',
        tier: profileData?.tier || 'N/A',
        feeDiscount: profileData?.feeDiscount || 'N/A',
        since: profileData?.since || 'N/A',
        securityScore: profileData?.securityScore || 'N/A',
    };

    const handleAction = (action: string) => {
        if (action === 'View Full Activity Log') {
            fetchFullActivityLog();
        } else {
            alert(`Simulating action: ${action}`);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    return (
        <>
            <ChangePasswordModal
                isOpen={isChangePasswordModalOpen}
                onClose={() => setIsChangePasswordModalOpen(false)}
                onSubmit={handleChangePasswordSubmit}
            />

            <div className="min-h-screen p-4 space-y-8 bg-gray-50 dark:bg-gray-900">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Account Settings</h1>

                <div className='flex items-center pb-4 space-x-6 border-b border-gray-200 dark:border-gray-700'>
                    <div className="flex items-center justify-center w-20 h-20 text-3xl font-bold text-white bg-indigo-500 border-4 border-white rounded-full shadow-md dark:border-gray-800">
                        {profile.name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</p>
                        <p className="text-gray-500 dark:text-gray-400">{profile.email}</p>
                    </div>
                </div>

                <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
                    <Card title="Profile Information" className='lg:col-span-2'>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <DetailItem label="Name" value={profile.name} icon={User} />
                            <DetailItem label="Email" value={profile.email} icon={Monitor} />
                            <DetailItem label="Member Since" value={profile.since} icon={Activity} />
                        </div>
                    </Card>

                    <Card title="Trading Status">
                        <div className="space-y-4">
                            <div className="flex flex-col p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/50">
                                <p className="font-semibold text-indigo-700 dark:text-indigo-300">Trading Tier</p>
                                <span className="text-2xl font-extrabold text-indigo-800 dark:text-indigo-400">{profile.tier}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-teal-50 dark:bg-teal-900/50">
                                <p className="flex items-center font-semibold text-teal-700 dark:text-teal-300"><DollarSign className='w-5 h-5 mr-2'/>Fee Discount</p>
                                <span className="text-xl font-bold text-teal-700 dark:text-teal-300">{profile.feeDiscount}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
                    <Card title="Security & Access" className='lg:col-span-3'>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="p-4 space-y-2 border border-yellow-200 rounded-lg dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30">
                                <div className='flex items-center font-bold text-yellow-700 dark:text-yellow-400'>
                                    <Shield className='w-5 h-5 mr-2' />
                                    Current Security Posture: <span className='ml-1'>{profile.securityScore}</span>
                                </div>
                                <p className='text-sm text-gray-700 dark:text-gray-300'>2FA is **Enabled**.</p>
                            </div>

                            <div className="space-y-3">
                                <ActionButton
                                    label="Manage 2FA"
                                    icon={Lock}
                                    color="indigo"
                                    onClick={() => handleAction('Manage 2FA')}
                                />
                                <ActionButton
                                    label="Change Password"
                                    icon={Monitor}
                                    color="gray"
                                    onClick={() => setIsChangePasswordModalOpen(true)}
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                <Card title="Recent Account Activity">
                    <div className="space-y-3 text-sm">
                        {activityLog.map((activity) => (
                            <div key={activity.id} className="flex flex-col justify-between p-3 transition border-l-4 border-indigo-500 rounded dark:border-indigo-600 sm:flex-row hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div className='flex items-center mb-1 sm:mb-0'>
                                    <Activity className='w-4 h-4 mr-3 text-indigo-500 shrink-0' />
                                    <p className="font-semibold text-gray-900 dark:text-white">{activity.action} <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({formatDate(activity.time)})</span></p>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">{activity.details}</p>
                            </div>
                        ))}
                    </div>
                    {!isFullLogLoaded && (
                        <div className='mt-4 text-center'>
                            <button onClick={() => handleAction('View Full Activity Log')} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                                View Full Activity Log
                            </button>
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
};

export default ProfilePage;
