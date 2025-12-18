
const fetch = require('node-fetch');

async function createAdmin() {
  try {
    console.log('Creating admin user...');

    const name = 'Admin';
    const email = 'dncyhrpr@gmail.com';
    const password = 'khan212';

    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Admin user created successfully in Firebase Authentication.');
      console.log('Please update the user role to "admin" in your database.');
    } else {
      console.error('Failed to create admin user:', data.error);
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

createAdmin();
