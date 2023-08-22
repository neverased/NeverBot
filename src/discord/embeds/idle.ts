module.exports = (embed = {}) => {
  return {
    title: 'Somethings wrong',
    color: 7143340,
    footer: {
      text: 'Made with ❤️ by @neverased',
      icon_url: 'https://avatars.githubusercontent.com/u/37114938?v=4',
    },
    ...embed,
  };
};
