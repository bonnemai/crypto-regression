YOUR_ACCOUNT_ID=833715352507
aws s3control put-public-access-block \
  --account-id $YOUR_ACCOUNT_ID \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

YOUR_BUCKET_NAME=regression-ui
aws s3api put-public-access-block \
  --bucket $YOUR_BUCKET_NAME \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

