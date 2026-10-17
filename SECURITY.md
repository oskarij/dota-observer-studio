# Security

Report a vulnerability privately through GitHub: open the **Security** tab of this repository and
choose **Report a vulnerability**. Do not open a public issue.

Observer Studio runs two local servers, the overlay host and the GSI listener. Both bind to
127.0.0.1 unless **Allow LAN access** is on. The GSI listener accepts only updates that carry the
auth token from this install's GSI config.
