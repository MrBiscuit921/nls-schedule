import {useEffect, useState} from "react";
import {useParams, useNavigate} from "react-router-dom";
import axios from "axios";
import "../../nls-styles.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function RoundForm() {
  const {id} = useParams();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    shortDate: "",
    days: [],
  });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchRound = async () => {
        const token = localStorage.getItem("adminToken");
        const res = await axios.get(`${API_URL}/rounds/${id}`, {
          headers: {Authorization: `Bearer ${token}`},
        });
        setFormData(res.data);
      };
      fetchRound();
    }
  }, [id]);

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const addDay = () => {
    setFormData({
      ...formData,
      days: [...formData.days, {label: "", sessions: []}],
    });
  };

  const updateDay = (idx, field, value) => {
    const newDays = [...formData.days];
    newDays[idx][field] = value;
    setFormData({...formData, days: newDays});
  };

  const addSession = (dayIdx) => {
    const newDays = [...formData.days];
    newDays[dayIdx].sessions.push({
      type: "",
      label: "",
      date: "",
      start: 0,
      startMin: 0,
      end: 0,
      endMin: 0,
    });
    setFormData({...formData, days: newDays});
  };

  const updateSession = (dayIdx, sessionIdx, field, value) => {
    const newDays = [...formData.days];
    newDays[dayIdx].sessions[sessionIdx][field] = value;
    setFormData({...formData, days: newDays});
  };

  const removeDay = (idx) => {
    const newDays = formData.days.filter((_, i) => i !== idx);
    setFormData({...formData, days: newDays});
  };

  const removeSession = (dayIdx, sessionIdx) => {
    const newDays = [...formData.days];
    newDays[dayIdx].sessions = newDays[dayIdx].sessions.filter(
      (_, i) => i !== sessionIdx,
    );
    setFormData({...formData, days: newDays});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem("adminToken");
    try {
      if (id) {
        await axios.put(`${API_URL}/rounds/${id}`, formData, {
          headers: {Authorization: `Bearer ${token}`},
        });
      } else {
        await axios.post(`${API_URL}/rounds`, formData, {
          headers: {Authorization: `Bearer ${token}`},
        });
      }
      navigate("/admin");
    } catch (err) {
      alert("Error saving round:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <h1 className="form-title">{id ? "Edit Round" : "New Round"}</h1>

      <div className="form-group">
        <label className="form-label">Round ID</label>
        <input
          className="form-input"
          name="id"
          value={formData.id}
          onChange={handleChange}
          placeholder="e.g. NLS1"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Round Name</label>
        <input
          className="form-input"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Round Name"
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Short Date</label>
        <input
          className="form-input"
          name="shortDate"
          value={formData.shortDate}
          onChange={handleChange}
          placeholder="e.g. 16 Apr"
          required
        />
      </div>

      <h3 className="section-title">Days & Sessions</h3>

      {formData.days.map((day, dayIdx) => (
        <div key={dayIdx} className="day-card">
          <div className="day-header">
            <input
              className="form-input"
              value={day.label}
              onChange={(e) => updateDay(dayIdx, "label", e.target.value)}
              placeholder="Day Label (e.g. Thursday 16 Apr)"
            />
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => removeDay(dayIdx)}>
              Remove Day
            </button>
          </div>

          <h4 className="sessions-title">Sessions</h4>

          {day.sessions.map((session, sessionIdx) => (
            <div key={sessionIdx} className="session-card">
              <div className="session-grid">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={session.type}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "type", e.target.value)
                    }>
                    <option value="">Select Type</option>
                    <option value="practice">Practice</option>
                    <option value="quali">Qualifying</option>
                    <option value="race">Race</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input
                    className="form-input"
                    value={session.label}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "label", e.target.value)
                    }
                    placeholder="e.g. Practice 1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={session.date}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "date", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Hour</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="23"
                    value={session.start}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "start", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Min</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="59"
                    value={session.startMin}
                    onChange={(e) =>
                      updateSession(
                        dayIdx,
                        sessionIdx,
                        "startMin",
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Hour</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="23"
                    value={session.end}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "end", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">End Min</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    max="59"
                    value={session.endMin}
                    onChange={(e) =>
                      updateSession(
                        dayIdx,
                        sessionIdx,
                        "endMin",
                        e.target.value,
                      )
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={session.endDate}
                    onChange={(e) =>
                      updateSession(dayIdx, sessionIdx, "endDate", e.target.value)
                    }
                  />
                </div>

              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => removeSession(dayIdx, sessionIdx)}>
                Remove Session
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addSession(dayIdx)}>
            + Add Session
          </button>
        </div>
      ))}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={addDay}>
          + Add Day
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Save Round"}
        </button>
      </div>
    </form>
  );
}
