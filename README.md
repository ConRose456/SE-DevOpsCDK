## DevOpsCDK
This is the infrastructre as code package for the cdk constructs that will configuree the reqiured aws resources needed to deploy this application.

### Build
To build this project run:

`npm run build`

### Deployment
You will need to deploy to they beta stage before you can run the local devServer so you will need to have an aws account and collect you credentials:
Secret keys can be found in the written report:
```
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
export AWS_DEFAULT_REGION=eu-west-2
```

Now you will need to synth the cdk to create the cloud formation assets that you are going to deploy:

`cdk synth`

And finally deploy those cloud formation assets to the beta stage:

`cdk deploy Beta-ServiceStack`