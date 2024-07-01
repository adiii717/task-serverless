## Live Deployment

To Deploy it to AWS, make sure to configure AWS profile and then run the following command


# Deploy the whole infrastructure with just one step

```sh
# on fresh install
npm install && export AWS_PROFILE=task && npm run deploy
# on regular deployment
export AWS_PROFILE=profilename && npm run deploy
```


## Local Testing

To Invoke the function locally, run the following command
It will also pass the test event file that lamda expects for user validation

```sh
npm run local-invoke
```



# Destroy the infrastructure

```sh
npm run destory
```



