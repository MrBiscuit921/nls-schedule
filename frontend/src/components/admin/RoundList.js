import {useEffect, useState} from "react";
import axios from "axios";
import {Link, useNavigate} from "react-router-dom";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function RoundList() {
  const [rounds, setRounds] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin/login");
    } else fetchRounds();
  }, [navigate]);

  const fetchRounds = async () => {
    const token = localStorage.getItem("adminToken");
    const config = {headers: {Authorization: `Bearer ${token}`}};
    try {
      const res = await axios.get(`${API_URL}/rounds`, config);
      setRounds(res.data);
    } catch (err) {
      console.error("Error fetching rounds:", err);
    }
  };

  const refreshFromWikipedia = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await axios.post(`${API_URL}/classifications/refresh`);
      setRefreshMessage({
        type: "success",
        text: "Classifications refreshed successfully from Wikipedia!",
      });
      setTimeout(() => setRefreshMessage(null), 5000);
    } catch (err) {
      console.error("Error refreshing classifications:", err);
      setRefreshMessage({
        type: "error",
        text: "Failed to refresh classifications. Please try again.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const deleteRound = async (id) => {
    if (!window.confirm("Are you sure you want to delete this round?")) return;
    const token = localStorage.getItem("adminToken");
    try {
      await axios.delete(`${API_URL}/rounds/${id}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      fetchRounds();
    } catch (err) {
      alert("Error deleting round:", err);
    }
  };

  return (
    <div className="admin-container">
      {/* Refresh from Wikipedia Section */}
      <div className="refresh-section">
        <h2>Update Classifications</h2>
        <p>
          Refresh driver and team standings from Wikipedia. This will fetch the
          latest classification data.
        </p>
        <button
          onClick={refreshFromWikipedia}
          disabled={isRefreshing}
          className="refresh-btn">
          {isRefreshing ? "Refreshing..." : "Refresh from Wikipedia"}
        </button>

        {refreshMessage && (
          <div className={`refresh-message ${refreshMessage.type}`}>
            {refreshMessage.text}
          </div>
        )}
      </div>

      {/* Manage Rounds Section */}
      <div className="admin-header">
        <h1>Manage Rounds</h1>
        <Link to="/admin/round/new" className="btn btn-primary">
          + New Round
        </Link>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Short Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.shortDate}</td>
                <td className="table-actions">
                  <Link to={`/admin/round/${r.id}/edit`}>
                    <button className="btn btn-primary btn-sm">Edit</button>
                  </Link>
                  <button
                    onClick={() => deleteRound(r.id)}
                    className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
