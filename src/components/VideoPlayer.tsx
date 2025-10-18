import React, { useEffect, useRef } from 'react';
import { VideoFile } from '../utils/db';

interface VideoPlayerProps {
  video: VideoFile;
  width?: number;
  height?: number;
  autoplay?: boolean;
  controls?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  width = 640,
  height = 360,
  autoplay = false,
  controls = true,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Video.js initialization removed - using native HTML5 video
    return () => {
      // Cleanup will be handled by React
    };
  }, [video, autoplay, controls]);

  return (
    <div className={`video-player-container ${className}`}>
      <video
        ref={videoRef}
        controls={controls}
        autoPlay={autoplay}
        style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
        onLoadedData={() => console.log('Video loaded successfully')}
        onError={(e) => console.error('Video error:', e)}
      >
        <source src={URL.createObjectURL(new Blob([new Uint8Array(video.data)], { type: video.type }))} type={video.type} />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default VideoPlayer;