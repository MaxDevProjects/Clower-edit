export function initSettings() {
  return {
    admin: {
      username: 'admin',
      password: ''
    },
    deployment: {
      host: '',
      port: 22,
      username: '',
      password: '',
      remotePath: ''
    },
    autoDeploy: false
  };
}
