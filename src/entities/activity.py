from __future__ import annotations
from datetime import timedelta
from typing import List
from src.entities.resource import Resource


class Activity:
    """
    Represents a physical activity within a project.

    An activity is a task or process that consumes resources and has a defined duration.
    It may depend on other activities, meaning it cannot start until certain preceding
    activities are completed. Additionally, each activity carries risks related to
    extended duration and discovery, which may impact project timelines.

    Attributes:
        duration (timedelta): The estimated time required to complete the activity.
        name (str): A descriptive name for the activity.
        resource (Resource): The resource allocated to perform the activity.
        dependencies (List[Activity]): A list of preceding activities that must be completed
            before this activity can start.
        risk_of_extended_duration (int): The likelihood (expressed as a percentage or scale)
            that the activity will take longer than estimated.
        risk_of_discovery (int): The likelihood (expressed as a percentage or scale) that
            unexpected issues or requirements will be discovered during the activity.
    """

    duration: timedelta
    name: str
    resource: Resource
    dependencies: List[Activity]
    risk_of_impounding: int         # Loss of resources -> less people, less trucks, loss of drugs, ... -> is a cost
    risk_of_extended_duration: int  # Delay on project -> 
    is_revealing_activity: bool
