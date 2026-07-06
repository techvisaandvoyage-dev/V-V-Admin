import React, { useState } from 'react';
import { api } from '../store/authStore';

const GoogleSheetsSyncModal = ({ isOpen, onClose, onSyncComplete }) => {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchPreview = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/google-sheets/preview');
      if (response.data.success) {
        setPreviewData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch preview');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const response = await api.post('/google-sheets/sync');
      if (response.data.success) {
        if (onSyncComplete) {
          onSyncComplete(response.data);
        }
        onClose();
      } else {
        setError(response.data.message || 'Failed to sync');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error connecting to server');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch preview when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setPreviewData(null);
      fetchPreview();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Sync from Google Sheets</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-500">Analyzing Google Sheet...</p>
            </div>
          ) : previewData ? (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Please review the changes before confirming the sync. Only rows with a valid Action (APPROVE, REJECT, SUBMITTED) or an updated Admin Remark will be processed.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                  <span className="block text-xs text-gray-500 uppercase">Rows Found</span>
                  <span className="block text-2xl font-bold text-gray-800">{previewData.rowsFound}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                  <span className="block text-xs text-gray-500 uppercase">Matched IDs</span>
                  <span className="block text-2xl font-bold text-green-600">{previewData.matchedIds}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-100">
                  <span className="block text-xs text-gray-500 uppercase">Invalid/Duplicate IDs</span>
                  <span className="block text-2xl font-bold text-red-600">{previewData.invalidIds + previewData.duplicateIds}</span>
                </div>
                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                  <span className="block text-xs text-blue-500 uppercase">Rows To Update</span>
                  <span className="block text-2xl font-bold text-blue-700">{previewData.rowsToUpdate}</span>
                </div>
              </div>

              {previewData.rowsToUpdate > 0 && (
                <div className="max-h-40 overflow-y-auto text-sm bg-gray-50 p-3 rounded border border-gray-200">
                  <ul className="space-y-1">
                    {previewData.details.map((detail, idx) => (
                      <li key={idx} className="flex justify-between border-b border-gray-200 pb-1 last:border-0 last:pb-0">
                        <span className="font-medium text-gray-700">{detail.applicationId}</span>
                        <span className="text-indigo-600">{detail.action || 'Remark Updated'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={syncing}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={loading || syncing || !previewData || previewData.rowsToUpdate === 0}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center"
          >
            {syncing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              'Confirm Sync'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleSheetsSyncModal;
