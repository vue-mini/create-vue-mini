import pxtorpx from 'postcss-pxtorpx-pro';

const config = {
  plugins: [pxtorpx({ transform: (x) => x })],
};

export default config;
