# flotilla

This doc is for use by streamlit developers.

## Prereqs
Follow the instructions to setup AWS and docker.
* [AWS](aws.md)
* [Docker](docker.md)


At the very least do this.
```
export AWS_PROFILE=${AWS_PROFILE:-streamlit}
export AWS_ACCESS_KEY_ID=$(aws --profile ${AWS_PROFILE} configure get aws_access_key_id)
export AWS_SECRET_ACCESS_KEY=$(aws --profile ${AWS_PROFILE} configure get aws_secret_access_key)
export AWS_DEFAULT_REGION=us-east-1
```

## Setup AWS ECS Cluster (Docker engine on AWS).
### Go to the ECS Cluster
[ECS Cluster Dashboard](https://us-east-1.console.aws.amazon.com/ecs/home?region=us-east-1)
Make sure you're in us-east-1 ie Northern Virginia. It defaults to that for some reason.
![aws_ecs_console.png](images/aws_ecs_console.png)<br>

### Create cluster
Make sure you pick EC2 Linux + Networking and not just Network (ie Fargate)
![aws_ecs_create_cluster.png](images/aws_ecs_create_cluster.png)<br>

### Configure cluster
Pick a name and select instance size.  At this stage a t2.small is good enough.  The rest defaults and click Create.
![aws_ecs_configure_cluster.png](images/aws_ecs_configure_cluster.png)<br>

## Setup AWS SQS rules
See this [bug](https://github.com/stitchfix/flotilla-os/issues/95)  This isnt necessary to do as I already did it
![aws_sqs.png](images/aws_sqs.png)

## Get source
```
$ git clone git@github.com:stitchfix/flotilla-os.git
```

## Build docker images.
```
$ cd flotilla-os
$ docker-compose build
```

## Run docker images
All three are started with the same command
* frontend - ui
* backend - flotilla
* postgres - db

```
$ docker-compose up
```

## Go to flotilla frontend

Go the [flotilla frontend](http://localhost:5000)

![flotilla_ui.png](images/flotilla_ui.png)

You might have to run docker-compose up a few times by control-c and
then just running up again.  There's some race condition on setup thats
a bug in flotilla.

## Create New Task
This creates what AWS calls a task definition.

Start filling it out, the only tricky part is create the group name, not
only do you have to type it in, but you have to click on create
![flotilla_create_task_group_name.png](images/flotilla_create_task_group_name.png)

Fill it out completely and for command add this
```
cat <<EOF | bash
while true; do
  sleep 1
  date 2>&1
done
EOF
```

It should look like this when you're done.
![flotilla_create_task.png](images/flotilla_create_task.png)

A pop up in the bottom right should show up.
![flotilla_task_created.png](images/flotilla_task_created.png)

## Run the task
Click on the run button which takes you here.
![flotilla_run_task.png](images/flotilla_run_task.png)

Select your cluster then hit run.  It will get submitted and pop up in
the bottom right should appear.
![flotilla_run_task_submitted.png](images/flotilla_run_task_submitted.png)

## Look at AWS cluster tasks.
Click on the first task (blue link) on the tasks tab under task.
![aws_ecs_cluster_task.png](images/aws_ecs_cluster_task.png)

Then click on logs and you should see logs in cloudwatch.
![aws_ecs_task_logs.png](images/aws_ecs_task_logs.png)


## Look for the logs back on the flotilla UI.
![flotilla_running.png](images/flotilla_running.png)

## Stop task.
![flotilla_stopped.png](images/flotilla_stopped.png)
