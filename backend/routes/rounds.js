const express = require('express');
const router = express.Router();
const Round = require('../models/Round');
const auth = require('../middleware/auth');

// @route   GET /api/rounds
router.get('/', async (req, res) => {
    try {
        const rounds = await Round.find().sort({ id: 1 });
        res.json(rounds);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// @route GET /api/rounds/:id
router.get('/:id', async (req, res) => {
    try {
        const round = await Round.findOne({ id: req.params.id });
        if (!round) {
            return res.status(404).json({ message: "Round not found" });
        }
        res.json(round);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// ALL ROUTES BELOW THIS LINE REQUIRE AUTHENTICATION

// @route   POST /api/rounds
router.post('/', auth, async (req, res) => {
    try {
        const newRound = new Round(req.body);
        const saved = await newRound.save();
        res.json(saved);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// @route   PUT /api/rounds/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const updated = await Round.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ message: "Round not found" });
        }
        res.json(updated);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// @route   DELETE /api/rounds/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const deleted = await Round.findOneAndDelete({ id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ message: "Round not found" });
        }
        res.json({ message: "Round deleted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

module.exports = router;