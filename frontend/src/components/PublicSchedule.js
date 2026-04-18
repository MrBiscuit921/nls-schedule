import {useEffect, useState} from "react";
import axios from "axios";
import {FaYoutube} from "react-icons/fa";

import "../nls-styles.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const convertToUTC = (dateStr, hour, minute = 0) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const monthIndex = month - 1;
  const isCEST = monthIndex >= 2 && monthIndex <= 9;
  const offset = isCEST ? 2 : 1;
  return new Date(Date.UTC(year, monthIndex, day, hour - offset, minute));
};

const formatLocalTime = (date, userTZ) => {
  try {
    return date.toLocaleString("en-US", {
      timeZone: userTZ,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toLocaleString("en-US", {hour: "2-digit", minute: "2-digit"});
  }
};

const getRoundStartDate = (round) => {
  let earliest = null;
  round.days.forEach((day) => {
    day.sessions.forEach((session) => {
      const startDate = convertToUTC(
        session.date,
        session.start,
        session.startMin || 0,
      );
      if (!earliest || startDate < earliest) earliest = startDate;
    });
  });
  return earliest;
};

const matchStreamToSession = (session, streams, roundName, dayLabel) => {
  if (!streams || streams.length === 0) return null;

  const dayOfWeek = dayLabel.split(" ")[0].toLowerCase(); // "saturday" or "sunday"
  const label = session.label.toLowerCase();

  // Determine which keyword to look for in the stream title
  let searchKeyword = null;

  if (
    label.includes("qualifying") &&
    !label.includes("top") &&
    dayOfWeek === "saturday"
  ) {
    // Qualifying (Race 1) on Saturday
    searchKeyword = "samstag";
  } else if (
    label.includes("race") &&
    !label.includes("2") &&
    dayOfWeek === "saturday"
  ) {
    // Race 1 on Saturday
    searchKeyword = "saturday";
  } else if (
    label.includes("qualifying") &&
    !label.includes("top") &&
    dayOfWeek === "sunday"
  ) {
    // Qualifying (Race 2) on Sunday
    searchKeyword = "sonntag";
  } else if (label.includes("top qualifying")) {
    // Top Qualifying
    searchKeyword = "top-qualifying";
  } else if (label.includes("race 2") || label.includes("nls5")) {
    // Race 2
    searchKeyword = "race 2";
  }

  if (!searchKeyword) return null;

  // Find the stream whose title contains the keyword
  return streams.find(
    (stream) =>
      stream.title.toLowerCase().includes(roundName.toLowerCase()) &&
      stream.title.toLowerCase().includes(searchKeyword),
  );
};

const sortDays = (round) => {
  return [...round.days].sort((a, b) => {
    const getEarliest = (day) => {
      let earliest = null;
      day.sessions.forEach((session) => {
        const startDate = convertToUTC(
          session.date,
          session.start,
          session.startMin || 0,
        );
        if (!earliest || startDate < earliest) earliest = startDate;
      });
      return earliest;
    };
    return getEarliest(a) - getEarliest(b);
  });
};

const sortSessions = (sessions) => {
  return [...sessions].sort((a, b) => {
    const dateA = convertToUTC(a.date, a.start, a.startMin || 0);
    const dateB = convertToUTC(b.date, b.start, b.startMin || 0);
    return dateA - dateB;
  });
};

export default function PublicSchedule() {
  const [rounds, setRounds] = useState([]);
  const [nextSession, setNextSession] = useState(null);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [userTZ, setUserTZ] = useState("");
  const [streams, setStreams] = useState([]);

  useEffect(() => {
    const fetchRounds = async () => {
      try {
        const res = await axios.get(`${API_URL}/rounds`);
        let roundsData = res.data;

        // Sort rounds by earliest session start date
        roundsData.sort((a, b) => {
          const dateA = getRoundStartDate(a);
          const dateB = getRoundStartDate(b);
          return dateA - dateB;
        });

        // Sort days and sessions
        roundsData = roundsData.map((round) => ({
          ...round,
          days: sortDays(round).map((day) => ({
            ...day,
            sessions: sortSessions(day.sessions),
          })),
        }));

        setRounds(roundsData);
      } catch (err) {
        console.error("Error fetching rounds:", err);
      }
    };

    fetchRounds();
    setUserTZ(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const fetchStreams = async () => {
      try {
        const res = await axios.get(`${API_URL}/youtube/streams`);
        setStreams(res.data);
      } catch (err) {
        console.error("Error fetching YouTube streams:", err);
      }
    };
    fetchStreams();
  }, []);

  useEffect(() => {
    if (!rounds.length) return;

    const computeNextSession = (roundsData) => {
      const now = new Date();
      let allSessions = [];
      roundsData.forEach((round) => {
        round.days.forEach((day) => {
          day.sessions.forEach((session) => {
            const startDate = convertToUTC(
              session.date,
              session.start,
              session.startMin || 0,
            );
            allSessions.push({
              roundId: round.id,
              roundName: round.name,
              ...session,
              startDate,
            });
          });
        });
      });
      allSessions.sort((a, b) => a.startDate - b.startDate);
      return allSessions.find((s) => s.startDate > now);
    };

    const next = computeNextSession(rounds);
    setNextSession(next);
  }, [rounds]);

  useEffect(() => {
    if (!nextSession) return;
    const interval = setInterval(() => {
      const diff = nextSession.startDate - new Date();
      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({days: 0, hours: 0, minutes: 0, seconds: 0});
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextSession]);

  const isRoundPast = (round) => {
    const lastDay = round.days[round.days.length - 1];
    const lastSession = lastDay.sessions[lastDay.sessions.length - 1];
    const endDateStr = lastSession.endDate || lastSession.date;
    const endDate = convertToUTC(
      endDateStr,
      lastSession.end,
      lastSession.endMin || 0,
    );
    return new Date() > endDate;
  };

  const isRoundNext = (round) => {
    if (isRoundPast(round)) return false;
    return nextSession && nextSession.roundId === round.id;
  };

  const renderSessions = (round) => {
    return round.days.map((day, idx) => (
      <div key={idx} className="day-block">
        <div className="day-label">{day.label}</div>
        {day.sessions.map((session, sidx) => {
          const startDate = convertToUTC(
            session.date,
            session.start,
            session.startMin || 0,
          );
          const endDateStr = session.endDate || session.date;
          const endDate = convertToUTC(
            endDateStr,
            session.end,
            session.endMin || 0,
          );
          const [month] = session.date.split("-").map(Number);
          const isCEST = month - 1 >= 2 && month - 1 <= 9;
          const TZ = isCEST ? "CEST" : "CET";
          const startStr = `${String(session.start).padStart(2, "0")}:${String(session.startMin || 0).padStart(2, "0")}`;
          const endStr = session.end
            ? `${String(session.end).padStart(2, "0")}:${String(session.endMin || 0).padStart(2, "0")}`
            : "";
          const cetStr = session.end
            ? `${startStr}-${endStr} ${TZ}`
            : `${startStr} ${TZ}`;
          const localStr =
            formatLocalTime(startDate) +
            (endDate ? ` - ${formatLocalTime(endDate)}` : "");

          const matchedStream = matchStreamToSession(
            session,
            streams,
            round.name,
            day.label,
          );
          const isStreamLive = matchedStream && matchedStream.status === "live";

          return (
            <div key={sidx} className="session-display-row">
              {/* Left side: session label + YouTube button */}
              <div className="session-left">
                <span className={`session-type ${session.type}`}>
                  {session.label}
                </span>
                {matchedStream && (
                  <button
                    className={`session-youtube-btn ${isStreamLive ? "live" : ""}`}
                    onClick={() => window.open(matchedStream.url, "_blank")}
                    title="Watch on YouTube">
                    <FaYoutube size={18} />
                  </button>
                )}
              </div>

              {/* Right side: local time + CET time */}
              <div className="session-right">
                <span className="session-local">{localStr}</span>
                <span className="session-cet">{cetStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  useEffect(() => {
    if (rounds.length > 0 && nextSession) {
      const nextRoundIndex = rounds.findIndex(
        (r) => r.id === nextSession.roundId,
      );
      if (nextRoundIndex > 0) {
        const nextRound = rounds[nextRoundIndex];
        const otherRounds = rounds.filter((r) => r.id !== nextSession.roundId);
        setRounds([nextRound, ...otherRounds]);
      }
    }
  }, [nextSession, rounds]);

  if (!rounds.length)
    return (
      <div className="wrap">
        Fetching schedule... (may take a moment on first load)
      </div>
    );

  return (
    <div className="wrap">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          marginBottom: "1.25rem",
        }}>
        <h1 style={{fontSize: "20px", fontWeight: "500"}}>NLS 2026 schedule</h1>
        <span
          style={{
            fontSize: "11px",
            fontWeight: "500",
            background: "#e0e7ff",
            color: "#1e40af",
            padding: "3px 10px",
            borderRadius: "12px",
          }}>
          all sessions
        </span>
      </div>

      <div className="countdown-card">
        <div className="countdown-label">Next session:</div>
        <div className="countdown-title">
          {nextSession
            ? `${nextSession.roundId}: ${nextSession.label}`
            : "No upcoming sessions"}
        </div>
        <div className="countdown-grid">
          <div className="count-unit">
            <div className="count-num">{countdown.days}</div>
            <div className="count-lbl">Days</div>
          </div>
          <div className="count-unit">
            <div className="count-num">{countdown.hours}</div>
            <div className="count-lbl">Hours</div>
          </div>
          <div className="count-unit">
            <div className="count-num">{countdown.minutes}</div>
            <div className="count-lbl">Minutes</div>
          </div>
          <div className="count-unit">
            <div className="count-num">{countdown.seconds}</div>
            <div className="count-lbl">Seconds</div>
          </div>
        </div>
        <div className="tz-note">
          {nextSession
            ? `Starts ${formatLocalTime(nextSession.startDate)} (${userTZ})`
            : ""}
        </div>
      </div>

      <div className="section-title"> Race Calendar</div>
      <div className="rounds">
        {rounds.map((round) => {
          const past = isRoundPast(round);
          const next = isRoundNext(round);
          return (
            <div
              key={round.id}
              className={`round-card ${past ? "past" : next ? "next-round" : ""}`}>
              <div className="round-header">
                <span className="round-num">{round.id}</span>
                <span className="round-name">{round.name}</span>
                <span className="round-date-sm">{round.shortDate}</span>
                <span
                  className={`status-badge ${past ? "badge-past" : next ? "badge-next" : "badge-upcoming"}`}>
                  {past ? "Past" : next ? "Next" : "Upcoming"}
                </span>
              </div>
              <div className={`sessions ${next ? "sessions-next" : ""}`}>
                {renderSessions(round)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
