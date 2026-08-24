/** Serve Tempo's prebuilt static assets through the Sites worker runtime. */
const worker = {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};

export default worker;
