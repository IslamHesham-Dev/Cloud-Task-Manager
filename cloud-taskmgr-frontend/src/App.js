// src/App.js
import React, { useEffect, useState } from 'react';
import { withAuthenticator, Button, Heading, View, Text, TextField } from '@aws-amplify/ui-react';
import TaskManager from './TaskManager';

function App({ signOut, user }) {
  const [authDetails, setAuthDetails] = useState(null);
  const [showTaskManager, setShowTaskManager] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    if (user) {
      // Log the full user object for debugging
      console.log('User authenticated with username:', user.username);

      try {
        // Try to load saved display name from localStorage
        const savedName = localStorage.getItem(`displayName_${user.username}`);

        if (savedName) {
          setDisplayName(savedName);
        } else {
          // If no saved name, use a default
          setDisplayName('Task Manager User');
          // Initialize the temp name too
          setTempName('Task Manager User');
        }

        // Extract user details for debugging
        const details = {
          username: user.username,
          attributes: user.attributes || 'No attributes found'
        };

        setAuthDetails(details);
      } catch (error) {
        console.error('Error extracting user details:', error);
      }
    } else {
      console.error('No user object found');
    }
  }, [user]);

  if (!user) {
    return <div>Authentication error. Please check console for details.</div>;
  }

  const toggleView = () => {
    setShowTaskManager(!showTaskManager);
  };

  const startEditingName = () => {
    setTempName(displayName);
    setIsEditingName(true);
  };

  const saveName = () => {
    if (tempName.trim()) {
      setDisplayName(tempName.trim());
      localStorage.setItem(`displayName_${user.username}`, tempName.trim());
    }
    setIsEditingName(false);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
  };

  // Custom welcome header with editable name
  const WelcomeHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
      <Heading level={2} style={{ margin: 0, marginRight: '10px' }}>
        Welcome, {displayName}
      </Heading>
      {!isEditingName ? (
        <Button size="small" onClick={startEditingName} variation="link">
          (Edit name)
        </Button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
          />
          <Button size="small" onClick={saveName} variation="primary" style={{ marginLeft: '5px' }}>
            Save
          </Button>
          <Button size="small" onClick={cancelEditingName} variation="link" style={{ marginLeft: '5px' }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: 20 }}>
      <WelcomeHeader />
      <View style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <Button onClick={toggleView}>
          {showTaskManager ? 'Show Auth Details' : 'Show Task Manager'}
        </Button>
        <Button onClick={signOut}>Sign Out</Button>
      </View>

      {showTaskManager ? (
        <>
          <hr />
          <TaskManager />
        </>
      ) : (
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <Heading level={3}>Authentication Details</Heading>
          <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
            {JSON.stringify(authDetails, null, 2)}
          </pre>
          <Text>If you can see your authentication details above, AWS Cognito is working correctly.</Text>
          <div style={{ marginTop: '15px' }}>
            <Text>User ID: {user.username}</Text>
            {user.attributes && user.attributes.email && (
              <Text>Email: {user.attributes.email}</Text>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuthenticator(App);
