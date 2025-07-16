require('dotenv').config();
const app = require('./app');
const db = require('./db')

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ MySQL database connection established!');
    connection.release();

    app.listen(PORT, () => {
      console.log(`✅ Server running on ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
    process.exit(1);
  }
})();