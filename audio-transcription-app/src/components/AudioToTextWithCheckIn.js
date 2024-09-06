import React, { useState, useRef, useEffect } from 'react';

const AudioToTextWithCheckIn = () => {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [recorder, setRecorder] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [username, setUsername] = useState('');
  const [recitedPages, setRecitedPages] = useState('');
  const [reciteDuration, setReciteDuration] = useState(0);
  const [checkInMessage, setCheckInMessage] = useState('');
  const [startTime, setStartTime] = useState(null);

  const audioChunks = useRef([]);

  useEffect(() => {
    return () => {
      if (recorder) {
        recorder.stop();
      }
    };
  }, [recorder]);

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const newRecorder = new MediaRecorder(stream);
        newRecorder.ondataavailable = e => {
          audioChunks.current.push(e.data);
        };
        newRecorder.onstop = () => {
          const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
          audioChunks.current = [];
        };
        newRecorder.start();
        setRecorder(newRecorder);
        setStartTime(new Date());
      });
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stop();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setStartTime(new Date());
  };

  const transcribeAudio = () => {
    if (startTime) {
      const endTime = new Date();
      setReciteDuration(Math.round((endTime - startTime) / 1000));
    }

    const formData = new FormData();
    formData.append('audio', audioBlob);

    fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      setOrderId(data.orderId);
      checkStatus();
      setTranscription(extractReadableText(data.transcription));
    })
    .catch(error => {
      console.error('Error:', error);
    });
  };

  const extractReadableText = (transcription) => {
    try {
      const parsedData = JSON.parse(transcription);
      let readableText = '';

      parsedData.lattice2.forEach(segment => {
        const words = segment.json_1best.st.rt[0].ws;
        words.forEach(wordGroup => {
          wordGroup.cw.forEach(word => {
            readableText += word.w;
          });
        });
      });

      return readableText;
    } catch (error) {
      console.error('Error parsing transcription:', error);
      return 'Error parsing transcription data.';
    }
  };

  const checkStatus = () => {
    setStatusMessage('Processing...');
    const interval = setInterval(() => {
      fetch(`/api/status/${orderId}`)
        .then(response => response.json())
        .then(data => {
          if (data.status === 'completed') {
            clearInterval(interval);
            setStatusMessage('Transcription complete!');
          } else {
            setStatusMessage(`Processing... Estimated time remaining: ${data.estimatedTime} seconds`);
          }
        })
        .catch(error => {
          console.error('Error:', error);
          clearInterval(interval);
          setStatusMessage('Error fetching status');
        });
    }, 5000);
  };

  const checkIn = () => {
    if (!username || !recitedPages || reciteDuration === 0) {
      setCheckInMessage('Please fill in all fields and record audio');
      return;
    }

    fetch('/api/record_recitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        recited_pages: recitedPages,
        recite_duration: reciteDuration
      })
    })
    .then(response => response.json())
    .then(data => {
      setCheckInMessage(data.message);
      console.log('Check-in record:', data.record);
    })
    .catch(error => {
      console.error('Error:', error);
      setCheckInMessage('Error during check-in');
    });
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold mb-6 text-center">Audio to Text with Check-in</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Record Audio</h2>
        <button onClick={startRecording} className="mr-2 bg-blue-500 text-white px-4 py-2 rounded">Start Recording</button>
        <button onClick={stopRecording} className="bg-red-500 text-white px-4 py-2 rounded">Stop Recording</button>
        {audioUrl && <audio src={audioUrl} controls className="mt-4 w-full" />}
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Audio</h2>
        <input type="file" onChange={handleFileUpload} accept="audio/*" className="w-full" />
      </div>
      
      <button onClick={transcribeAudio} className="mb-6 bg-green-500 text-white px-4 py-2 rounded">Transcribe</button>
      
      {transcription && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Transcription</h2>
          <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">{transcription}</pre>
        </div>
      )}
      
      {statusMessage && (
        <div className="mb-6 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <p>{statusMessage}</p>
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Check-in</h2>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="mb-2 w-full px-3 py-2 border rounded"
        />
        <input
          type="text"
          value={recitedPages}
          onChange={(e) => setRecitedPages(e.target.value)}
          placeholder="Recited Pages (e.g. 1,2,3)"
          className="mb-2 w-full px-3 py-2 border rounded"
        />
        <p className="mb-2">Duration: {formatDuration(reciteDuration)}</p>
        <button onClick={checkIn} className="bg-purple-500 text-white px-4 py-2 rounded">Check-in</button>
      </div>
      
      {checkInMessage && (
        <div className="mb-6 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4">
          <p>{checkInMessage}</p>
        </div>
      )}
    </div>
  );
};

export default AudioToTextWithCheckIn;