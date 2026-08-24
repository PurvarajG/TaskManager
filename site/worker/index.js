/** Serve Tempo's prebuilt static assets through the Sites worker runtime. */
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
