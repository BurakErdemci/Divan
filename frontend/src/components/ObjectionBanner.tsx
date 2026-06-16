import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const objectionModules = import.meta.glob('../assets/objection*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const objectionImg = (Object.values(objectionModules)[0] as string | undefined) ?? '';

interface ObjectionBannerProps {
  show: boolean;
  text?: string;
  color: string;
}

export const ObjectionBanner: React.FC<ObjectionBannerProps> = ({ show, text = 'İTİRAZ!', color }) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-slate-950/20"
        >
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="absolute left-0 right-0 h-32 md:h-44 flex items-center justify-center overflow-hidden border-y-4 border-white shadow-[0_0_30px_rgba(0,0,0,0.8)]"
            style={{
              backgroundColor: color,
              borderColor: '#ffffff',
            }}
          >
            <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)]" />

            {objectionImg ? (
              <motion.img
                src={objectionImg}
                alt={text}
                initial={{ scale: 0.2, rotate: -15 }}
                animate={{
                  scale: [0.2, 1.3, 1.1],
                  rotate: [-15, 5, -2],
                  x: [0, -4, 4, -2, 2, 0],
                  y: [0, 4, -4, 2, -2, 0],
                }}
                exit={{ scale: 3, opacity: 0, rotate: 15 }}
                transition={{
                  duration: 0.4,
                  times: [0, 0.6, 1],
                  x: { repeat: 5, duration: 0.08, type: 'tween' },
                  y: { repeat: 5, duration: 0.08, type: 'tween' },
                }}
                className="max-h-[85%] object-contain select-none filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              />
            ) : (
              <motion.div
                initial={{ scale: 0.2, rotate: -15 }}
                animate={{ scale: [0.2, 1.3, 1.1], rotate: [-15, 5, -2] }}
                exit={{ scale: 3, opacity: 0, rotate: 15 }}
                className="font-pixel text-5xl md:text-7xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              >
                {text}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
