// src/TaskManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { awsConfig } from './aws-config';

export default function TaskManager() {
    const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(null);
    const [tokenFormat, setTokenFormat] = useState('bearer'); // 'bearer', 'raw', or 'cognitoIdentity'
    const [editingTask, setEditingTask] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDueDate, setEditDueDate] = useState('');

    const apiEndpoint = awsConfig?.API?.REST?.CloudTaskMgrAPI?.endpoint || '';

    // Function to get Authorization header based on current token format
    const getAuthHeader = useCallback((currentToken) => {
        switch (tokenFormat) {
            case 'bearer':
                return `Bearer ${currentToken}`;
            case 'raw':
                return currentToken;
            case 'cognitoIdentity':
                return `Cognito ${currentToken}`;
            default:
                return `Bearer ${currentToken}`;
        }
    }, [tokenFormat]);

    // Toggle token format when retry button is clicked
    const toggleTokenFormat = () => {
        setTokenFormat(format => {
            switch (format) {
                case 'bearer': return 'raw';
                case 'raw': return 'cognitoIdentity';
                case 'cognitoIdentity': return 'bearer';
                default: return 'bearer';
            }
        });
    };

    // Define fetchTasks with useCallback to avoid dependency issues
    const fetchTasks = useCallback(async (authToken) => {
        if (!authToken && !token) {
            setError('No authentication token available');
            setLoading(false);
            return;
        }

        const currentToken = authToken || token;
        const authHeader = getAuthHeader(currentToken);

        try {
            setLoading(true);
            setError(null);
            console.log(`Fetching tasks from API with token format: ${tokenFormat}`);
            console.log(`Authorization header: ${authHeader.substring(0, 20)}...`);

            // Use direct fetch instead of Amplify API
            const response = await fetch(`${apiEndpoint}/tasks`, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });

            console.log('API response status:', response.status);

            if (!response.ok) {
                throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
            }

            // Try to parse the response as JSON
            let data;
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.log('Raw response:', text);
                try {
                    data = JSON.parse(text);
                } catch (e) {
                    console.log('Response is not JSON');
                    if (text.trim()) {
                        data = [{ title: 'Sample Task (API returned non-JSON)', taskId: 'sample' }];
                    } else {
                        data = [];
                    }
                }
            }

            console.log('Tasks received:', data);
            setTasks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setError(`Failed to fetch tasks: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [apiEndpoint, token, tokenFormat, getAuthHeader]);

    useEffect(() => {
        // Get the auth token first, then fetch tasks
        async function initialize() {
            try {
                const session = await fetchAuthSession();
                const idToken = session.tokens?.idToken?.toString();
                console.log('Auth session obtained:', !!idToken);
                if (idToken) {
                    console.log('Token preview:', idToken.substring(0, 20) + '...');
                }
                setToken(idToken);
                await fetchTasks(idToken);
            } catch (err) {
                console.error('Error initializing:', err);
                setError(`Authentication error: ${err.message}`);
                setLoading(false);
            }
        }

        initialize();
    }, [fetchTasks]);

    async function createTask() {
        if (!title) {
            alert('Please enter a task title');
            return;
        }

        if (!token) {
            alert('No authentication token available');
            return;
        }

        try {
            console.log('Creating task:', { title, dueDate });
            const newTask = { title, dueDate: dueDate || null };
            const authHeader = getAuthHeader(token);

            // Use direct fetch instead of Amplify API
            const response = await fetch(`${apiEndpoint}/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newTask)
            });

            console.log('Create task status:', response.status);

            if (!response.ok) {
                throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
            }

            let created;
            try {
                created = await response.json();
            } catch (e) {
                const text = await response.text();
                console.log('Response text:', text);
                try {
                    created = JSON.parse(text);
                } catch (e2) {
                    created = { ...newTask, taskId: Date.now().toString() };
                }
            }

            console.log('Task created:', created);
            setTasks([...tasks, created]);
            setTitle('');
            setDueDate('');
        } catch (err) {
            console.error('Error creating task:', err);
            alert(`Failed to create task: ${err.message}`);
        }
    }

    async function updateTask(taskId) {
        if (!editTitle) {
            alert('Please enter a task title');
            return;
        }

        if (!token) {
            alert('No authentication token available');
            return;
        }

        try {
            console.log('Updating task:', { taskId, title: editTitle, dueDate: editDueDate });
            const updatedTask = { title: editTitle, dueDate: editDueDate || null };
            const authHeader = getAuthHeader(token);

            // Use direct fetch instead of Amplify API
            const response = await fetch(`${apiEndpoint}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedTask)
            });

            console.log('Update task status:', response.status);

            if (!response.ok) {
                throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
            }

            // Update local state with the updated task
            const updatedTasks = tasks.map(task =>
                task.taskId === taskId ? { ...task, ...updatedTask } : task
            );

            setTasks(updatedTasks);
            setEditingTask(null);
            setEditTitle('');
            setEditDueDate('');

            alert('Task updated successfully!');
        } catch (err) {
            console.error('Error updating task:', err);
            alert(`Failed to update task: ${err.message}`);
        }
    }

    async function deleteTask(taskId) {
        if (!window.confirm('Are you sure you want to delete this task?')) {
            return;
        }

        if (!token) {
            alert('No authentication token available');
            return;
        }

        try {
            console.log('Deleting task:', taskId);
            const authHeader = getAuthHeader(token);

            // Use direct fetch instead of Amplify API
            const response = await fetch(`${apiEndpoint}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Delete task status:', response.status);

            if (!response.ok) {
                throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
            }

            // Update local state by removing the deleted task
            setTasks(tasks.filter(task => task.taskId !== taskId));

            alert('Task deleted successfully!');
        } catch (err) {
            console.error('Error deleting task:', err);
            alert(`Failed to delete task: ${err.message}`);
        }
    }

    function startEditing(task) {
        setEditingTask(task.taskId);
        setEditTitle(task.title);
        setEditDueDate(task.dueDate || '');
    }

    function cancelEditing() {
        setEditingTask(null);
        setEditTitle('');
        setEditDueDate('');
    }

    async function handleFileUpload(taskId, file) {
        if (!file) return;

        if (!token) {
            alert('No authentication token available');
            return;
        }

        try {
            console.log(`Uploading file for task ${taskId}:`, file.name);
            const authHeader = getAuthHeader(token);

            // Step 1: Get pre-signed URL from the backend
            const response = await fetch(`${apiEndpoint}/tasks/${taskId}/attachment`, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Get attachment URL status:', response.status);

            if (!response.ok) {
                throw new Error(`API returned status code ${response.status}: ${response.statusText}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (e) {
                const text = await response.text();
                console.log('Response text:', text);
                try {
                    data = JSON.parse(text);
                } catch (e2) {
                    throw new Error('Invalid response from server');
                }
            }

            // Step 2: Extract the upload URL from the response
            if (!data || !data.uploadUrl) {
                throw new Error('No upload URL received from server');
            }

            const { uploadUrl } = data;
            console.log('Received pre-signed URL:', uploadUrl);

            // Step 3: Upload directly to S3 using the pre-signed URL with fetch
            const uploadResult = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type, // Setting the correct content type
                }
            });

            if (!uploadResult.ok) {
                throw new Error(`Upload failed with status: ${uploadResult.status}`);
            }

            console.log('Upload successful!');
            alert('File uploaded successfully!');
        } catch (err) {
            console.error('Error uploading file:', err);
            alert(`Failed to upload file: ${err.message}`);
        }
    }

    if (loading) return <div>Loading tasks...</div>;

    if (error) {
        return (
            <div style={{ color: 'red', padding: '20px', border: '1px solid #ffcccc', borderRadius: '5px', background: '#fff5f5' }}>
                <h3>API Connection Error</h3>
                <p>{error}</p>
                <p>Current token format: <strong>{tokenFormat}</strong></p>
                <p>Please check:</p>
                <ul>
                    <li>API Gateway endpoint is correct: <code>{apiEndpoint}</code></li>
                    <li>API Gateway CORS settings allow requests from this origin</li>
                    <li>Lambda functions are properly deployed and working</li>
                    <li>IAM permissions are correctly set up</li>
                </ul>
                <button onClick={() => {
                    toggleTokenFormat();
                    fetchTasks();
                }}>
                    Retry with different token format ({tokenFormat === 'bearer' ? 'raw' : tokenFormat === 'raw' ? 'cognitoIdentity' : 'bearer'})
                </button>
                <div style={{ marginTop: '20px', padding: '10px', background: '#f8f8f8', border: '1px solid #ddd' }}>
                    <h4>Available Endpoints</h4>
                    <ul style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                        <li>GET - {apiEndpoint}/tasks</li>
                        <li>POST - {apiEndpoint}/tasks</li>
                        <li>PATCH - {apiEndpoint}/tasks/{'{id}'}</li>
                        <li>DELETE - {apiEndpoint}/tasks/{'{id}'}</li>
                        <li>GET - {apiEndpoint}/tasks/{'{id}'}/attachment</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3>Create a Task</h3>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                    placeholder="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ padding: '8px', minWidth: '200px' }}
                />
                <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    style={{ padding: '8px' }}
                />
                <button
                    onClick={createTask}
                    style={{ padding: '8px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Create
                </button>
            </div>

            <h3>Your Tasks</h3>
            {tasks.length === 0 ? (
                <p>No tasks found. Create one above!</p>
            ) : (
                <div>
                    {tasks.map(task => (
                        <div key={task.taskId || task.id || Date.now()}
                            style={{
                                border: '1px solid #ccc',
                                padding: '15px',
                                margin: '10px 0',
                                borderRadius: '5px',
                                background: '#f9f9f9'
                            }}
                        >
                            {editingTask === task.taskId ? (
                                // Edit mode
                                <div>
                                    <h4>Edit Task</h4>
                                    <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            placeholder="Title"
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            style={{ padding: '8px', flex: 1 }}
                                        />
                                        <input
                                            type="date"
                                            value={editDueDate}
                                            onChange={e => setEditDueDate(e.target.value)}
                                            style={{ padding: '8px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => updateTask(task.taskId)}
                                            style={{ padding: '6px 10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={cancelEditing}
                                            style={{ padding: '6px 10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // View mode
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div>
                                            <strong style={{ fontSize: '1.1em' }}>{task.title}</strong>
                                            <div style={{ color: '#666', marginTop: '5px' }}>
                                                Due: {task.dueDate || 'No due date'}
                                            </div>
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => startEditing(task)}
                                                style={{
                                                    marginRight: '10px',
                                                    padding: '5px 10px',
                                                    background: '#17a2b8',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteTask(task.taskId)}
                                                style={{
                                                    padding: '5px 10px',
                                                    background: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px' }}>Add Attachment:</label>
                                        <input
                                            type="file"
                                            onChange={e => handleFileUpload(task.taskId || task.id, e.target.files[0])}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
