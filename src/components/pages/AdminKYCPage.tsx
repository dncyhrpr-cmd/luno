'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface KYCRequest {
  id: string;
  userId: string;
  fullName: string;
  idType: string;
  idNumber: string;
  selfieUrl: string;
  documentUrl: string;
  status: string;
}

const AdminKYCPage = () => {
  const [kycRequests, setKycRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuth();

  useEffect(() => {
    const fetchKycRequests = async () => {
      if (!accessToken) {
        setError("Authentication token not found.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/admin/kyc', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch KYC requests');
        }
        const data = await response.json();
        setKycRequests(data.kycRequests);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchKycRequests();
  }, [accessToken]);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const reason = status === 'rejected' ? prompt('Enter rejection reason:') : undefined;
    if (status === 'rejected' && !reason) {
      alert('Rejection reason is required.');
      return;
    }

    if (!accessToken) {
        setError("Authentication token not found.");
        return;
    }

    try {
      const response = await fetch(`/api/admin/kyc/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ status, reason }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${status} KYC request`);
      }

      // Refresh the list after update
      setKycRequests(kycRequests.filter((req) => req.id !== id));

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleViewFile = async (filePath: string) => {
    if (!filePath) {
      alert('No file available');
      return;
    }

    if (filePath.startsWith('http')) {
      window.open(filePath, '_blank');
      return;
    }

    if (!accessToken) {
      setError("Authentication token not found.");
      return;
    }

    try {
      const response = await fetch(`/api/admin/files?path=${encodeURIComponent(filePath)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      const data = await response.json();
      window.open(data.downloadURL, '_blank');

    } catch (err: any) {
      setError(err.message);
    }

  }

  if (loading) return <p>Loading KYC requests...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">KYC Management</h1>
      {kycRequests.length === 0 ? (
        <p>No pending KYC requests.</p>
      ) : (
        <div className="luno-card">
          <table className="min-w-full w-full">
          <thead>
            <tr>
              <th className="py-2">User ID</th>
              <th className="py-2">Full Name</th>
              <th className="py-2">ID Type</th>
              <th className="py-2">ID Number</th>
              <th className="py-2">Selfie</th>
              <th className="py-2">Document</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {kycRequests.map((req) => (
              <tr key={req.id}>
                <td className="border px-4 py-2">{req.userId}</td>
                <td className="border px-4 py-2">{req.fullName}</td>
                <td className="border px-4 py-2">{req.idType}</td>
                <td className="border px-4 py-2">{req.idNumber}</td>
                <td className="border px-4 py-2">{req.selfieUrl ? <button onClick={() => handleViewFile(req.selfieUrl)} className="text-blue-500 hover:underline">View</button> : 'N/A'}</td>
                <td className="border px-4 py-2">{req.documentUrl ? <button onClick={() => handleViewFile(req.documentUrl)} className="text-blue-500 hover:underline">View</button> : 'N/A'}</td>
                <td className="border px-4 py-2">
                  <button 
                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                    className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminKYCPage;