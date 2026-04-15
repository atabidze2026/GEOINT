export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = request.body;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === adminUsername && password === adminPassword) {
    // Return a session token
    const token = Buffer.from(`${adminUsername}:${adminPassword}`).toString('base64');
    return response.status(200).json({ success: true, token });
  } else {
    return response.status(401).json({ success: false, error: 'არასწორი მომხმარებელი ან პაროლი' });
  }
}
