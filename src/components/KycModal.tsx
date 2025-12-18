'use client';

import React, { useState } from 'react';
import { Shield, Upload, X } from 'lucide-react';

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  // User view props
  onSubmit?: (data: { fullName: string; dateOfBirth: string; address: string; documentImage?: string; selfieImage?: string; idType?: string; idNumber?: string; phoneNumber?: string; nationality?: string }) => Promise<void>;
  // Admin view props
  s3Url?: string;
  onApprove?: (reason: string) => void;
  onReject?: (reason: string) => void;
  isAdminView?: boolean;
}

// Helper to convert file to Base64
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        // The result includes the Base64 prefix (e.g., 'data:image/png;base64,'), so we split and take the second part.
        const result = reader.result as string;
        resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
});

const KycModal: React.FC<KycModalProps> = ({ isOpen, onClose, onSubmit, s3Url, onApprove, onReject, isAdminView = false }) => {
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationality, setNationality] = useState('');
  const [idType, setIdType] = useState('passport');
  const [idNumber, setIdNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalReason, setApprovalReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) { // Guard against missing props
      setError('An unexpected error occurred. Please try again later.');
      return;
    }

    // Validate required fields before submitting
    if (!fullName.trim() || !dateOfBirth || !address.trim() || !idNumber.trim() || !idType) {
      setError('Please fill all required fields (name, DOB, address, ID type and number).');
      return;
    }
    if (!document) {
      setError('Please upload your identification document.');
      return;
    }
    if (!selfie) {
      setError('Please upload your selfie image.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      let base64Document = '';
      let base64Selfie = '';
      if (document) {
        // Convert the document to a Base64 string before submitting
        base64Document = await toBase64(document);
      }
      if (selfie) {
        base64Selfie = await toBase64(selfie);
      }
      await onSubmit({
        fullName,
        dateOfBirth,
        address,
        documentImage: base64Document || undefined,
        selfieImage: base64Selfie || undefined,
        idType: idType || undefined,
        idNumber: idNumber || undefined,
        phoneNumber: phoneNumber || undefined,
        nationality: nationality || undefined,
      });
      onClose(); // Close modal on successful submission
    } catch (err: any) {
        setError(`Submission failed: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    if (!onReject) return;
    if (!rejectionReason) {
        setError('Rejection reason is required.');
        return;
    }
    setError(null);
    onReject(rejectionReason);
  }

  const handleApprove = () => {
      if(onApprove) {
          onApprove(approvalReason);
      }
  }

    const isFormValid = !!(fullName.trim() && dateOfBirth && address.trim() && idNumber.trim() && idType && document && selfie);

  // Admin View
  if (isAdminView) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="luno-card max-w-2xl m-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review KYC Submission</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={24} />
                    </button>
                </div>
                {s3Url ? (
                    <div className="mb-6">
                        <img src={s3Url} alt="KYC Document" className="w-full h-auto max-h-96 object-contain rounded-md border border-gray-300 dark:border-gray-600" />
                    </div>
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400">Document not available.</p>
                )}
                 <div className="mb-4">
                    <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rejection Reason (if rejecting)</label>
                    <textarea
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Provide a clear reason for rejection"
                        rows={3}
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="approvalReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Approval Reason (Optional)</label>
                    <textarea
                        id="approvalReason"
                        value={approvalReason}
                        onChange={(e) => setApprovalReason(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Optionally, provide a reason for approval"
                        rows={3}
                    />
                </div>

                {error && <p className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>}

                <div className="flex justify-end space-x-4">
                    <button onClick={handleReject} className="py-2 px-4 rounded-md text-sm font-semibold text-white bg-red-600 hover:bg-red-700">
                        Reject
                    </button>
                    <button onClick={handleApprove} className="py-2 px-4 rounded-md text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                        Approve
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // User Submission View
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="luno-card max-w-md m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Shield className="mr-3 text-indigo-500" />
            Identity Verification (KYC)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          To comply with regulations, we need to verify your identity. Please provide your full legal name and upload a government-issued ID.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Legal Name</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
            <input
              type="date"
              id="dateOfBirth"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <input
              type="text"
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="123 Main St, Anytown, USA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identification Document</label>
            <div className="mt-1 flex flex-col items-center px-4 pt-3 pb-2 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-2 text-center w-full">
                    <Upload className="mx-auto h-10 w-10 text-gray-400" />
                    <div className="flex items-center justify-center gap-3">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 px-3 py-2 border border-gray-100">
                            <span>Upload document</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={(e) => {
                              const f = e.target.files ? e.target.files[0] : null;
                              if (f) {
                                if (f.size > 10 * 1024 * 1024) {
                                  setError('Document file is too large (max 10MB)');
                                  setDocument(null);
                                  setDocumentPreview(null);
                                  return;
                                }
                                // Accept images and PDFs
                                const allowed = ['image/png','image/jpeg','application/pdf'];
                                if (!allowed.includes(f.type)) {
                                  setError('Unsupported document type. Use PNG/JPG/PDF');
                                  setDocument(null);
                                  setDocumentPreview(null);
                                  return;
                                }
                                setDocument(f);
                                setDocumentPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
                                setError(null);
                              } else {
                                setDocument(null);
                                setDocumentPreview(null);
                              }
                            }} />
                        </label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, PDF up to 10MB</p>
                    {document && <p className='text-sm text-green-600 dark:text-green-400'>{document.name}</p>}
                    {documentPreview && <img src={documentPreview} alt="document preview" className="mt-2 w-40 h-28 object-contain rounded-md border" />}
                </div>
            </div>
           </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Selfie (hold ID next to face)</label>
            <div className="mt-1">
              <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files ? e.target.files[0] : null)} />
              {selfie && <p className='text-sm text-green-600 dark:text-green-400'>{selfie.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Type</label>
              <select value={idType} onChange={(e) => setIdType(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md">
                <option value="passport">Passport</option>
                <option value="driving_license">Driving License</option>
                <option value="national_id">National ID</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Number</label>
              <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
              <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nationality</label>
              <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <div className="flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 rounded-md text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !isFormValid} className="py-2 px-6 rounded-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center">
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                  Submitting...
                </>
              ) : (
                'Submit for Verification'
              )}
            </button>
          </div>
          {!isFormValid && <p className="text-xs text-gray-500 mt-2">Required: name, date of birth, address, ID type & number, document and selfie.</p>}
        </form>
      </div>
    </div>
  );
};

export default KycModal;
