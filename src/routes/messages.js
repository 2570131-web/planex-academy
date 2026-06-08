import express from 'express';
import { getDb } from '../config/firebase.js';

const router = express.Router();


// ✅ POST message (public form)
router.post('/', async (req, res) => {
  try {
    console.log("🔥 Incoming:", req.body);

    const { name, phone, email, subject, message } = req.body;

    const newMessage = {
      name: name || "",
      email: email || "",
      mobile: phone || "",
      subject: subject || "",
      message: message || "",
      createdAt: new Date(),
      read: false
    };

    const docRef = await getDb()
      .collection('messages')
      .add(newMessage);

    console.log("✅ Saved ID:", docRef.id);

    return res.json({
      success: true,
      id: docRef.id
    });

  } catch (err) {
    console.error("❌ FIREBASE ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
});


// ✅ GET all messages (admin)
router.get('/', async (req, res) => {
  try {
    const snap = await getDb()
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .get();

    const messages = [];

    snap.forEach(doc => {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ messages });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ GET single message by ID
router.get('/:id', async (req, res) => {
  try {
    const doc = await getDb()
      .collection('messages')
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({
      id: doc.id,
      ...doc.data()
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ MARK message as read
router.put('/:id/read', async (req, res) => {
  try {
    const ref = getDb()
      .collection('messages')
      .doc(req.params.id);

    await ref.update({ read: true });

    const updatedDoc = await ref.get();

    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data()
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;