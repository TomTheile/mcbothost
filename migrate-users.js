const fs = require('fs');
const { Client } = require('pg');

async function migrateUsers() {
  // Datenbank-Client erstellen
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Verbunden mit PostgreSQL-Datenbank');

    // JSON-Datenbank lesen
    const jsonDb = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const users = jsonDb.users || {};
    
    // Benutzer migrieren
    let insertedCount = 0;
    for (const email in users) {
      const user = users[email];
      try {
        const result = await client.query(
          'INSERT INTO users (email, username, password, verified, role, banned, created_at, last_login) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [
            user.email,
            user.username,
            user.password,
            user.verified || false,
            user.role || 'user',
            user.banned || false,
            user.created ? new Date(user.created) : new Date(),
            user.last_login ? new Date(user.last_login) : null
          ]
        );
        console.log(`Benutzer migriert: ${user.username} (${user.email})`);
        insertedCount++;
      } catch (err) {
        console.error(`Fehler beim Migrieren von ${email}: ${err.message}`);
      }
    }
    console.log(`Migration abgeschlossen. ${insertedCount} Benutzer importiert.`);
  } catch (err) {
    console.error('Fehler bei der Migration:', err);
  } finally {
    await client.end();
  }
}

migrateUsers();